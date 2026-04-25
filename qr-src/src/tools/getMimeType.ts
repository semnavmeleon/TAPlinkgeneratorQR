export default function getMimeType(extension: string): string {
  if (!extension) throw new Error("Extension must be defined");
  if (extension[0] === ".") extension = extension.substring(1);
  const types: Record<string, string> = { png:"image/png", jpeg:"image/jpeg", jpg:"image/jpeg", svg:"image/svg+xml", webp:"image/webp", pdf:"application/pdf" };
  const type = types[extension.toLowerCase()];
  if (!type) throw new Error(`Extension "${extension}" is not supported`);
  return type;
}
