/**
 * Strips sensitive fields from a user document before it goes over the wire.
 * Used everywhere a user is returned, so a new field can never accidentally
 * be exposed by forgetting a manual projection.
 */
const toPublicUser = (user) => {
  if (!user) return null;

  const plain =
    typeof user.toObject === "function" ? user.toObject() : { ...user };

  const { password, __v, ...safe } = plain;

  return safe;
};

module.exports = { toPublicUser };
