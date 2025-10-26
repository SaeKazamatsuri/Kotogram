<script setup lang="ts">
import { onMounted } from "vue";

const { listStages } = useStageLoader();
const { stageClear } = useStats();

onMounted(async () => {
  const stages = await listStages();
  for (const stage of stages) {
    stageClear(stage.id, 0);
  }
  await navigateTo("/", { replace: true });
});
</script>

<template>
  <div class="flex h-full items-center justify-center p-6 text-slate-600">
    リダイレクトしています…
  </div>
</template>

