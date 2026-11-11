/** Short, stable hash used to recognize earlier default texts. */
export function promptHash(text: string): string {
    let x = 5381;
    for (let i = 0; i < text.length; i++) x = ((x * 33) ^ text.charCodeAt(i)) >>> 0;
    return x.toString(36);
}
