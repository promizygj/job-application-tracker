/** The only user fields ever sent to clients. */
export const toPublicUser = (u) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  headline: u.headline,
  location: u.location,
  timezone: u.timezone,
  avatarUrl: u.avatarUrl,
  emailVerified: Boolean(u.emailVerifiedAt),
  createdAt: u.createdAt,
});
