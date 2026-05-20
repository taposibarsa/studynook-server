const { ObjectId } = require('mongodb');

function isObjectIdString(id) {
  if (typeof id !== 'string' || !ObjectId.isValid(id)) return false;
  return new ObjectId(id).toString() === id;
}

/** Store in MongoDB as ObjectId when possible, otherwise string (better-auth ids). */
function toDbUserId(id) {
  if (id instanceof ObjectId) return id;
  if (isObjectIdString(id)) return new ObjectId(id);
  return id;
}

/** Query ownerId / userId whether stored as ObjectId or string. */
function userIdMatchQuery(field, userId) {
  const values = [userId];
  if (isObjectIdString(userId)) {
    values.push(new ObjectId(userId));
  }
  return { [field]: { $in: values } };
}

function userIdsMatch(a, b) {
  if (a == null || b == null) return false;
  return a.toString() === b.toString();
}

module.exports = { isObjectIdString, toDbUserId, userIdMatchQuery, userIdsMatch };
