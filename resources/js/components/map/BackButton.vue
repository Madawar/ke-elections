<script setup lang="ts">
// The floating back button: it names the level above the focused unit and steps up to it.
// `parent` is the name to show ("Mathare", "All of Kenya"), or null while nothing is focused.
defineProps<{ parent: string | null }>();
defineEmits<{ stepUp: [] }>();
</script>

<template>
    <button
        v-if="parent"
        type="button"
        data-onboarding="back"
        class="pointer-events-auto flex min-h-11 max-w-full items-center gap-1 rounded-md border border-hairline bg-surface py-1 pr-3.5 pl-2 text-[15px] font-medium text-ink shadow-sm active:bg-ground focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none"
        :aria-label="`Back to ${parent}`"
        @click="$emit('stepUp')"
    >
        <svg viewBox="0 0 20 20" class="size-5 shrink-0" aria-hidden="true">
            <path
                d="M12.5 4 6.5 10l6 6"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
        </svg>
        <span class="truncate">{{ parent }}</span>
    </button>
</template>
