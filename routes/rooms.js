const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

const AMENITY_OPTIONS = [
  'Whiteboard',
  'Projector',
  'Wi-Fi',
  'Power Outlets',
  'Quiet Zone',
  'Air Conditioning',
];

function buildRoomsQuery(query) {
  const filter = {};

  if (query.search) {
    filter.name = { $regex: query.search, $options: 'i' };
  }

  if (query.amenities) {
    const list = query.amenities.split(',').filter(Boolean);
    if (list.length) {
      filter.amenities = { $in: list };
    }
  }

  if (query.minRate) {
    filter.hourlyRate = { ...filter.hourlyRate, $gte: Number(query.minRate) };
  }

  if (query.maxRate) {
    filter.hourlyRate = { ...filter.hourlyRate, $lte: Number(query.maxRate) };
  }

  return filter;
}

router.get('/meta/amenities', (_req, res) => {
  res.json(AMENITY_OPTIONS);
});

router.get('/latest', async (req, res) => {
  try {
    const db = getDb();
    const rooms = await db
      .collection('rooms')
      .find({})
      .sort({ createdAt: -1 })
      .limit(6)
      .toArray();

    res.json(rooms);
  } catch (error) {
    console.error('Latest rooms error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/mine', authMiddleware, async (req, res) => {
  try {
    const db = getDb();
    const rooms = await db
      .collection('rooms')
      .find({ ownerId: new ObjectId(req.user.id) })
      .sort({ createdAt: -1 })
      .toArray();

    res.json(rooms);
  } catch (error) {
    console.error('My rooms error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const filter = buildRoomsQuery(req.query);
    const rooms = await db
      .collection('rooms')
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    res.json(rooms);
  } catch (error) {
    console.error('List rooms error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid room id' });
    }

    const db = getDb();
    const room = await db.collection('rooms').findOne({
      _id: new ObjectId(id),
    });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const isOwner =
      req.user && room.ownerId.toString() === req.user.id.toString();

    res.json({ ...room, isOwner });
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, description, image, floor, capacity, hourlyRate, amenities } =
      req.body;

    if (
      !name ||
      !description ||
      !image ||
      floor === undefined ||
      !capacity ||
      hourlyRate === undefined
    ) {
      return res.status(400).json({ message: 'Required fields missing' });
    }

    const db = getDb();
    const room = {
      name,
      description,
      image,
      floor: String(floor),
      capacity: Number(capacity),
      hourlyRate: Number(hourlyRate),
      amenities: Array.isArray(amenities) ? amenities : [],
      ownerId: new ObjectId(req.user.id),
      bookingCount: 0,
      createdAt: new Date(),
    };

    const result = await db.collection('rooms').insertOne(room);
    const created = await db.collection('rooms').findOne({
      _id: result.insertedId,
    });

    res.status(201).json(created);
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid room id' });
    }

    const db = getDb();
    const room = await db.collection('rooms').findOne({
      _id: new ObjectId(id),
    });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (room.ownerId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { name, description, image, floor, capacity, hourlyRate, amenities } =
      req.body;

    const update = {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(image !== undefined && { image }),
      ...(floor !== undefined && { floor: String(floor) }),
      ...(capacity !== undefined && { capacity: Number(capacity) }),
      ...(hourlyRate !== undefined && { hourlyRate: Number(hourlyRate) }),
      ...(amenities !== undefined && {
        amenities: Array.isArray(amenities) ? amenities : room.amenities,
      }),
    };

    await db.collection('rooms').updateOne(
      { _id: new ObjectId(id) },
      { $set: update }
    );

    const updated = await db.collection('rooms').findOne({
      _id: new ObjectId(id),
    });

    res.json(updated);
  } catch (error) {
    console.error('Update room error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid room id' });
    }

    const db = getDb();
    const room = await db.collection('rooms').findOne({
      _id: new ObjectId(id),
    });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (room.ownerId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await db.collection('bookings').deleteMany({
      roomId: new ObjectId(id),
    });

    await db.collection('rooms').deleteOne({ _id: new ObjectId(id) });

    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
