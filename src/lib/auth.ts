export function getUserId(): string {
  const id = process.env.SELF_HOSTED_USER_ID;
  if (!id) {
    throw new Error("SELF_HOSTED_USER_ID is not set");
  }
  return id;
}
