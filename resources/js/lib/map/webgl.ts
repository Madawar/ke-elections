export function supportsWebGL2(
    create: () => HTMLCanvasElement = () => document.createElement('canvas'),
): boolean {
    try {
        return !!create().getContext('webgl2');
    } catch {
        return false;
    }
}
