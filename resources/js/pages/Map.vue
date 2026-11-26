<script setup lang="ts">
defineProps<{ unit: { level: string; code: number; name: string } | null }>();
</script>

<template>
    <main>{{ unit?.name }}</main>
</template>
