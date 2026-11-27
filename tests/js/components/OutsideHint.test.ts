import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OutsideHint, {
    HINT_KEY,
    MAX_SHOWS,
    hintText,
    markHintUsed,
} from '@/components/map/OutsideHint.vue';

const mountHint = () =>
    mount(OutsideHint, {
        props: { unit: 'Mathare', parent: 'Nairobi City' },
        attachTo: document.body,
    });
type Hint = ReturnType<typeof mountHint>;
const nudge = (w: Hint) =>
    (w.vm as unknown as { nudge: () => boolean }).nudge();
const dismiss = (w: Hint) =>
    (w.vm as unknown as { dismiss: () => void }).dismiss();
const count = () => Number(localStorage.getItem(HINT_KEY) ?? 0);

beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
});
afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
});

describe('OutsideHint', () => {
    it('is not shown until a tap outside is ignored', () => {
        const w = mountHint();
        expect(w.text()).toBe('');
    });

    it('says what to do, with both controls named', async () => {
        const w = mountHint();
        expect(nudge(w)).toBe(true);
        await w.vm.$nextTick();
        expect(w.text()).toContain(
            "You're viewing Mathare. Go back to see more, or show the surroundings to pick a neighbour.",
        );
        const buttons = w.findAll('button').map((b) => b.text());
        expect(buttons).toEqual(['Back to Nairobi City', 'Show surroundings']);
    });

    it('has the same words for the live region', () => {
        expect(hintText('Mathare')).toBe(
            "You're viewing Mathare. Go back to see more, or show the surroundings to pick a neighbour.",
        );
    });

    it('asks to step up and closes when Back is pressed', async () => {
        const w = mountHint();
        nudge(w);
        await w.vm.$nextTick();
        await w.findAll('button')[0].trigger('click');
        expect(w.emitted('stepUp')).toHaveLength(1);
        expect(w.text()).toBe('');
    });

    it('asks to show the surroundings and closes when that is pressed', async () => {
        const w = mountHint();
        nudge(w);
        await w.vm.$nextTick();
        await w.findAll('button')[1].trigger('click');
        expect(w.emitted('showSurroundings')).toHaveLength(1);
        expect(w.text()).toBe('');
    });

    it('closes by itself after 6 seconds', async () => {
        const w = mountHint();
        nudge(w);
        await w.vm.$nextTick();
        vi.advanceTimersByTime(5900);
        await w.vm.$nextTick();
        expect(w.text()).not.toBe('');
        vi.advanceTimersByTime(200);
        await w.vm.$nextTick();
        expect(w.text()).toBe('');
    });

    it('closes on Escape', async () => {
        const w = mountHint();
        nudge(w);
        await w.vm.$nextTick();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        await w.vm.$nextTick();
        expect(w.text()).toBe('');
    });

    it('closes when the page dismisses it (the next map tap)', async () => {
        const w = mountHint();
        nudge(w);
        await w.vm.$nextTick();
        dismiss(w);
        await w.vm.$nextTick();
        expect(w.text()).toBe('');
    });

    it('a second ignored tap while it is open closes it instead of counting again', async () => {
        const w = mountHint();
        expect(nudge(w)).toBe(true);
        await w.vm.$nextTick();
        expect(nudge(w)).toBe(false);
        await w.vm.$nextTick();
        expect(w.text()).toBe('');
        expect(count()).toBe(1);
    });

    it('counts each showing in localStorage and stops after three', async () => {
        const w = mountHint();
        for (let i = 1; i <= MAX_SHOWS; i++) {
            expect(nudge(w)).toBe(true);
            expect(count()).toBe(i);
            dismiss(w);
        }
        expect(nudge(w)).toBe(false);
        await w.vm.$nextTick();
        expect(w.text()).toBe('');
        expect(count()).toBe(MAX_SHOWS);
    });

    it('counts shows made in earlier visits', () => {
        localStorage.setItem(HINT_KEY, '2');
        const w = mountHint();
        expect(nudge(w)).toBe(true);
        dismiss(w);
        expect(nudge(w)).toBe(false);
    });

    it('never shows once the back button or the switch has been used', () => {
        markHintUsed();
        const w = mountHint();
        expect(nudge(w)).toBe(false);
        expect(w.text()).toBe('');
    });

    it('using either of its own buttons ends the hint for good', async () => {
        const w = mountHint();
        nudge(w);
        await w.vm.$nextTick();
        await w.findAll('button')[1].trigger('click');
        expect(nudge(w)).toBe(false);
    });

    it('with storage blocked, still stops after three showings', () => {
        const blocked = () => {
            throw new Error('blocked');
        };
        const get = vi
            .spyOn(Storage.prototype, 'getItem')
            .mockImplementation(blocked);
        const set = vi
            .spyOn(Storage.prototype, 'setItem')
            .mockImplementation(blocked);
        const w = mountHint();
        for (let i = 0; i < MAX_SHOWS; i++) {
            expect(nudge(w)).toBe(true);
            dismiss(w);
        }
        expect(nudge(w)).toBe(false);
        get.mockRestore();
        set.mockRestore();
    });

    it('is compact on a phone: one short visible line and the buttons side by side, the full words kept for screen readers', async () => {
        const w = mountHint();
        nudge(w);
        await w.vm.$nextTick();
        const spans = w.findAll('p > span');
        expect(spans[0].text()).toBe("You're viewing Mathare.");
        expect(spans[0].classes()).not.toContain('max-md:sr-only');
        expect(spans[1].text()).toBe(
            'Go back to see more, or show the surroundings to pick a neighbour.',
        );
        expect(spans[1].classes()).toContain('max-md:sr-only');
        const row = w.get('[data-hint-buttons]');
        expect(row.classes()).toContain('flex-row');
        expect(row.classes()).toContain('md:flex-col');
        for (const b of row.findAll('button')) {
            expect(b.classes()).toContain('flex-1');
            expect(b.classes()).toContain('min-h-11');
        }
    });

    it('is a plain card, not a modal, and does not take focus', async () => {
        const w = mountHint();
        nudge(w);
        await w.vm.$nextTick();
        expect(w.find('[role="dialog"]').exists()).toBe(false);
        expect(document.activeElement).toBe(document.body);
    });
});
