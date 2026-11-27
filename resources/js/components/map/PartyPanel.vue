<script setup lang="ts">
// A party's profile, shown in the panel or sheet like a unit: who the party is (colour, 2022
// coalition, former names, ORPP registration with its source) and what it holds now, seat by seat
// across Kenya. The counts are the legend's (lib/party.ts), so they always agree with it.
import { computed, ref } from 'vue';
import { formatAsOf, siteUrl } from '@/lib/export/format';
import type { SeatKey } from '@/lib/map/colouring';
import type { FocusSelection } from '@/lib/map/focus';
import { SEAT_COLOURS } from '@/lib/map/theme';
import type { PartyScope } from '@/lib/map/urls';
import { partyProfile, scopeChoices } from '@/lib/party';
import type { SeatsData } from '@/lib/seats';
import type { UnitIndex } from '@/lib/units';

const props = defineProps<{
    seats: SeatsData;
    /** The party's abbreviation. */
    abbrev: string;
    /** The units, to scope the numbers to a county or a constituency (without them: all of Kenya). */
    index?: UnitIndex | null;
    /** What the numbers cover: a county or a constituency; null (the default) is all of Kenya. */
    scope?: PartyScope;
    /** The unit the map is focused on, which decides the scopes offered. */
    focus?: FocusSelection | null;
}>();
const emit = defineEmits<{
    /** The scope switch: the place the numbers should cover (null: all of Kenya). */
    scope: [scope: PartyScope];
    /** "Show on map": colour the map by this seat and highlight the party. */
    show: [seat: SeatKey];
    /** "Share party card". */
    share: [];
}>();

const profile = computed(() =>
    partyProfile(props.seats, props.abbrev, {
        index: props.index ?? undefined,
        scope: props.scope ?? null,
    }),
);
const choices = computed(() =>
    props.index
        ? scopeChoices(props.index, props.focus ?? null, props.scope ?? null)
        : [],
);
const chosen = (c: { key: string }) =>
    c.key ===
    (profile.value?.scope
        ? `${profile.value.scope.level}-${profile.value.scope.code}`
        : 'kenya');
const asOf = computed(() => formatAsOf(profile.value?.asOf));
const fmt = (n: number) => n.toLocaleString('en-GB');
const counted = (r: { count: number; total: number; share: string }) =>
    `${fmt(r.count)} of ${fmt(r.total)} (${r.share})`;
const place = computed(() =>
    profile.value?.scope ? profile.value.scope.name : 'all of Kenya',
);
/** The bar is the party's share of this seat, so a full bar would be every seat of the kind. */
const widthOf = (r: { count: number; total: number }) =>
    `${Number(((r.count / (r.total || 1)) * 100).toFixed(1))}%`;
const seatColour = (seat: string) =>
    seat in SEAT_COLOURS
        ? SEAT_COLOURS[seat as keyof typeof SEAT_COLOURS]
        : null;

const longDate = (date: string | null) => formatAsOf(date);

const copied = ref('');
let copiedTimer = 0;
async function copyLink() {
    if (!profile.value) return;
    const url = siteUrl(profile.value.path);
    try {
        await navigator.clipboard.writeText(url);
        copied.value = 'Link copied';
    } catch {
        copied.value = url;
    }
    window.clearTimeout(copiedTimer);
    copiedTimer = window.setTimeout(() => (copied.value = ''), 4000);
}
</script>

<template>
    <div v-if="profile" class="space-y-5 text-ink">
        <div class="flex items-center gap-3">
            <span
                data-swatch
                class="size-8 shrink-0 rounded-[3px] border border-hairline"
                :style="{ background: profile.colour }"
                aria-hidden="true"
            />
            <div class="min-w-0">
                <p class="text-[18px] leading-tight font-semibold">
                    {{ profile.abbrev }}
                </p>
                <p class="text-[13px] text-muted-ink">
                    {{ profile.hasOwnColour ? 'Colour on the map' : 'Grey on the map, with the other parties' }}
                </p>
            </div>
        </div>

        <dl class="space-y-1 text-[14px]">
            <div v-if="profile.coalition" class="flex gap-2">
                <dt class="w-28 shrink-0 text-muted-ink">2022 coalition</dt>
                <dd>{{ profile.coalition }}</dd>
            </div>
            <div v-if="profile.formerNames.length" class="flex gap-2">
                <dt class="w-28 shrink-0 text-muted-ink">Formerly</dt>
                <dd>
                    <template
                        v-for="(f, i) in profile.formerNames"
                        :key="f.abbrev"
                    >
                        <span v-if="i > 0">, </span>
                        {{ f.abbrev
                        }}<template v-if="f.effectiveOn">
                            (renamed {{ longDate(f.effectiveOn) }})</template
                        >
                    </template>
                </dd>
            </div>
            <div v-if="profile.registration" class="flex gap-2">
                <dt class="w-28 shrink-0 text-muted-ink">Registration</dt>
                <dd>
                    {{ profile.registration.status }}
                    <template v-if="profile.registration.sourceUrl">
                        (<a
                            :href="profile.registration.sourceUrl"
                            target="_blank"
                            rel="noopener"
                            class="underline underline-offset-2"
                            >{{
                                profile.registration.sourceName ?? 'source'
                            }}</a
                        >)</template
                    >
                </dd>
            </div>
        </dl>

        <fieldset v-if="choices.length > 1" data-scope-switch>
            <legend class="mb-1 text-[15px] font-semibold">Numbers for</legend>
            <div class="flex flex-wrap gap-1.5">
                <button
                    v-for="c in choices"
                    :key="c.key"
                    type="button"
                    :data-scope="c.key"
                    class="min-h-11 rounded-md border px-3 text-[14px]"
                    :class="
                        chosen(c)
                            ? 'border-ink bg-ground font-semibold'
                            : 'border-hairline'
                    "
                    :aria-pressed="chosen(c)"
                    @click="emit('scope', c.scope)"
                >
                    {{ c.label }}
                </button>
            </div>
        </fieldset>

        <section>
            <h3 class="mb-1 text-[15px] font-semibold">Seats held now</h3>
            <p class="mb-2 text-[13px] text-muted-ink">
                <template v-if="profile.scope"
                    >In {{ place }}, as a share of the seats there.</template
                >
                <template v-else
                    >Across all of Kenya, as a share of each seat's current
                    holders.</template
                >
            </p>
            <template v-if="profile.hasSeats || profile.scope">
                <ul class="divide-y divide-hairline border-y border-hairline">
                    <li
                        v-for="r in profile.rows"
                        :key="r.seat"
                        :data-seat-row="r.seat"
                        class="flex items-center gap-3 py-2"
                    >
                        <span
                            v-if="seatColour(r.seat)"
                            data-seat-colour
                            class="w-1.5 shrink-0 self-stretch rounded-[1px]"
                            :style="{ background: seatColour(r.seat)! }"
                            aria-hidden="true"
                        />
                        <div class="min-w-0 flex-1">
                            <p
                                class="flex items-baseline justify-between gap-2 text-[15px]"
                            >
                                <span>{{ r.label }}</span>
                                <span class="tabular-nums">{{ r.value }}</span>
                            </p>
                            <div
                                data-track
                                class="mt-1.5 h-2.5 rounded-[2px] bg-hairline"
                                aria-hidden="true"
                            >
                                <div
                                    data-bar
                                    class="h-full rounded-[2px]"
                                    :class="r.count > 0 ? 'min-w-0.5' : ''"
                                    :style="{
                                        width: widthOf(r),
                                        background: profile.colour,
                                    }"
                                />
                            </div>
                        </div>
                        <button
                            v-if="r.mapSeat && r.count > 0"
                            type="button"
                            :data-show-on-map="r.mapSeat"
                            class="min-h-11 w-24 shrink-0 px-1 text-right text-[14px] underline underline-offset-4"
                            :aria-label="`Show ${profile.abbrev} ${r.label} on the map`"
                            @click="emit('show', r.mapSeat)"
                        >
                            Show on map
                        </button>
                        <!-- Keeps every bar the same length, with or without the button -->
                        <span
                            v-else-if="profile.hasSeats || profile.scope"
                            class="w-24 shrink-0"
                            aria-hidden="true"
                        />
                    </li>
                    <li
                        data-seat-row="elected"
                        class="flex items-center gap-3 py-2"
                    >
                        <div class="min-w-0 flex-1">
                            <p
                                class="flex items-baseline justify-between gap-2 text-[15px] font-semibold whitespace-nowrap"
                            >
                                <span>Total elected seats</span>
                                <span class="tabular-nums">{{
                                    counted(profile.elected)
                                }}</span>
                            </p>
                            <div
                                data-track
                                class="mt-1.5 h-2.5 rounded-[2px] bg-hairline"
                                aria-hidden="true"
                            >
                                <div
                                    data-bar
                                    class="h-full rounded-[2px] min-w-0.5"
                                    :style="{
                                        width: widthOf(profile.elected),
                                        background: profile.colour,
                                    }"
                                />
                            </div>
                        </div>
                        <span class="w-24 shrink-0" aria-hidden="true" />
                    </li>
                </ul>
                <p v-if="!profile.scope" class="mt-1 text-[13px] text-muted-ink">
                    Nominated seats are filled from party lists, so they have no
                    area on the map. Elected seats are governors, senators,
                    woman reps, MPs and MCAs.
                </p>
            </template>
            <p v-else class="text-[15px] text-muted-ink">No current seats</p>
        </section>

        <section v-if="profile.topCounties.length" data-top-counties>
            <h3 class="mb-1 text-[15px] font-semibold">
                Where it holds the most MCA seats
            </h3>
            <ul class="divide-y divide-hairline border-y border-hairline">
                <li
                    v-for="c in profile.topCounties"
                    :key="c.code"
                    class="flex items-baseline justify-between gap-2 py-1.5 text-[14px]"
                >
                    <span>{{ c.name }}</span>
                    <span class="tabular-nums">{{ c.value }}</span>
                </li>
            </ul>
        </section>

        <div v-if="profile.heldAnywhere">
            <button
                type="button"
                data-share-card
                class="mb-2 flex h-11 w-full items-center justify-center rounded-md bg-ink px-3 text-[15px] font-medium text-surface"
                @click="emit('share')"
            >
                Share party card
            </button>
            <button
                type="button"
                class="flex h-11 w-full items-center justify-center rounded-md border border-hairline bg-surface px-3 text-[15px]"
                @click="copyLink"
            >
                Copy link
            </button>
            <p
                class="mt-1 min-h-5 truncate text-[13px] text-muted-ink"
                aria-live="polite"
            >
                {{ copied }}
            </p>
        </div>

        <p class="text-[12px] text-muted-ink">
            Seats: {{ profile.source
            }}{{ asOf ? `. Data as of ${asOf}` : '' }}.
            <template v-if="profile.registration?.sourceName"
                >Registration and coalition: ORPP,
                {{ profile.registration.sourceName }}.</template
            >
        </p>
    </div>
    <p v-else class="text-[15px] text-muted-ink">
        This party is not in the data.
    </p>
</template>
