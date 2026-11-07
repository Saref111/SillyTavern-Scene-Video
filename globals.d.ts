export {};

declare global {
    // Globals provided by SillyTavern at runtime.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SillyTavern: { getContext: () => any };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toastr: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const $: any;
}
