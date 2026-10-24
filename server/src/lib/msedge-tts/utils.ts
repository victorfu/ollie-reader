export const joinPath = (...parts: string[]) => {
    return parts
        .filter(Boolean)
        .join("/")
        .replace(/\/{2,}/g, "/");
}