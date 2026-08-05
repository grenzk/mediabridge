<script setup lang="ts">
import { computed } from 'vue'

type FolderTreeNode = {
  children: FolderTreeNode[]
  name: string
  path: string[]
}

const props = defineProps<{
  depth?: number
  nodes?: FolderTreeNode[]
  paths?: string[][]
}>()

const currentDepth = computed(() => props.depth ?? 0)
const treeNodes = computed(() => props.nodes ?? buildFolderTree(props.paths ?? []))

function buildFolderTree(paths: string[][]): FolderTreeNode[] {
  const roots: FolderTreeNode[] = []

  for (const path of paths) {
    let siblings = roots
    const currentPath: string[] = []

    for (const name of path) {
      currentPath.push(name)

      let node = siblings.find(candidate => candidate.name === name)

      if (!node) {
        node = { children: [], name, path: [...currentPath] }
        siblings.push(node)
      }

      siblings = node.children
    }
  }

  return roots
}
</script>

<template>
  <ul class="folder-tree" :class="{ root: currentDepth === 0 }">
    <li v-for="node in treeNodes" :key="node.path.join('/')" class="folder-tree-node">
      <div class="folder-tree-row" :title="node.path.join(' > ')">
        <i
          class="pi"
          :class="currentDepth === 0 ? 'pi-folder-open' : 'pi-folder'"
          aria-hidden="true"
        />
        <span>{{ node.name }}</span>
      </div>

      <FolderHierarchyTree
        v-if="node.children.length"
        :depth="currentDepth + 1"
        :nodes="node.children"
      />
    </li>
  </ul>
</template>

<style scoped>
.folder-tree {
  margin: 0;
  padding: 0;
  list-style: none;
}

.folder-tree:not(.root) {
  margin-left: 8px;
  padding-left: 20px;
  border-left: 1px solid var(--kw-border-subtle);
}

.folder-tree-node {
  position: relative;
}

.folder-tree:not(.root) > .folder-tree-node::before {
  position: absolute;
  top: 14px;
  left: -20px;
  width: 14px;
  border-top: 1px solid var(--kw-border-subtle);
  content: '';
}

.folder-tree:not(.root) > .folder-tree-node:last-child::after {
  position: absolute;
  top: 15px;
  bottom: 0;
  left: -21px;
  width: 2px;
  background: var(--kw-surface);
  content: '';
}

.folder-tree-row {
  display: flex;
  min-width: 0;
  min-height: 28px;
  align-items: center;
  gap: 8px;
  color: var(--kw-text-muted);
  font-size: 0.8125rem;
  line-height: 1.25rem;
}

.folder-tree-row > i {
  width: 16px;
  flex: 0 0 16px;
  color: var(--kw-text-disabled);
  font-size: 0.875rem;
  text-align: center;
}

.folder-tree.root > .folder-tree-node > .folder-tree-row > i {
  color: var(--kw-focus);
}

.folder-tree-row > span {
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>
