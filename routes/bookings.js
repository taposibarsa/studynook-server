const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const TIME_SLOTS = [];
for (let h = 8; h <= 20; h++) {
  TIME_SLOTS.push(`${String(h).padStart(2, '0')}:00`);
}

function parseHour(time) {
  return parseInt(time.split(':')[0], 10);
}

function computeTotalCost(startTime, endTime, hourlyRate) {
  const hours = parseHour(endTime) - parseHour(startTime);
  return hours * hourlyRate;
}

router.get('/mine', authMiddleware, async (req, res) => {
  try {
    const db = getDb();
    const bookings = await db
      .collection('bookings')
      .aggregate([
        { $match: { userId: new ObjectId(req.user.id) } },
        { $sort: { createdAt: -1 } },
        {
          $lookup: {
            from: 'rooms',
            localField: 'roomId',
            foreignField: '_id',
            as: 'room',
          },
        },
        { $unwind: { path: '$room', preserveNullAndEmptyArrays: true } },
      ])
      .toArray();

    res.json(bookings);
  } catch (error) {
    console.error('My bookings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { roomId, date, startTime, endTime, note } = req.body;

    if (!roomId || !date || !startTime || !endTime) {
      return res.status(400).json({ message: 'Required booking fields missing' });
    }

    if (!ObjectId.isValid(roomId)) {
      return res.status(400).json({ message: 'Invalid room id' });
    }

    if (!TIME_SLOTS.includes(startTime) || !TIME_SLOTS.includes(endTime)) {
      return res.status(400).json({ message: 'Invalid time slot' });
    }

    if (parseHour(endTime) <= parseHour(startTime)) {
      return res
        .status(400)
        .json({ message: 'End time must be after start time (minimum 1 hour)' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const bookingDate = new Date(date + 'T00:00:00');
    if (bookingDate < today) {
      return res.status(400).json({ message: 'Date must be today or in the future' });
    }

    const db = getDb();
    const room = await db.collection('rooms').findOne({
      _id: new ObjectId(roomId),
    });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const conflict = await db.collection('bookings').findOne({
      roomId: new ObjectId(roomId),
      date,
      status: 'confirmed',
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
    });

    if (conflict) {
      return res
        .status(409)
        .json({ message: 'This time slot is already booked for this room' });
    }

    const totalCost = computeTotalCost(startTime, endTime, room.hourlyRate);

    const booking = {
      roomId: new ObjectId(roomId),
      userId: new ObjectId(req.user.id),
      date,
      startTime,
      endTime,
      totalCost,
      note: note || '',
      status: 'confirmed',
      createdAt: new Date(),
    };

    const result = await db.collection('bookings').insertOne(booking);

    await db.collection('users').updateOne(
      { _id: new ObjectId(req.user.id) },
      { $push: { bookingIds: result.insertedId } }
    );

    await db.collection('rooms').updateOne(
      { _id: new ObjectId(roomId) },
      { $inc: { bookingCount: 1 } }
    );

    const created = await db.collection('bookings').findOne({
      _id: result.insertedId,
    });

    res.status(201).json(created);
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid booking id' });
    }

    const db = getDb();
    const booking = await db.collection('bookings').findOne({
      _id: new ObjectId(id),
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ message: 'Booking already cancelled' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const bookingDate = new Date(booking.date + 'T00:00:00');
    if (bookingDate < today) {
      return res.status(400).json({ message: 'Cannot cancel past bookings' });
    }

    await db.collection('bookings').updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: 'cancelled' } }
    );

    await db.collection('users').updateOne(
      { _id: new ObjectId(req.user.id) },
      { $pull: { bookingIds: new ObjectId(id) } }
    );

    res.json({ message: 'Booking cancelled' });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
