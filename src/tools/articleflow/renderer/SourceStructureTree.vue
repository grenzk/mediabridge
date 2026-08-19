<script setup lang="ts">
import { computed } from 'vue'

type SourceTreeNode = {
  children: SourceTreeNode[]
  kind: 'file' | 'folder'
  name: string
  path: string[]
}

const props = defineProps<{
  depth?: number
  filePaths?: string[][]
  folderPaths?: string[][]
  nodes?: SourceTreeNode[]
}>()

const currentDepth = computed(() => props.depth ?? 0)
const treeNodes = computed(() => props.nodes ?? buildSourceTree(props.folderPaths ?? [], props.filePaths ?? []))

function buildSourceTree(folderPaths: string[][], filePaths: string[][]): SourceTreeNode[] {
  const roots: SourceTreeNode[] = []

  for (const path of folderPaths) {
    addPath(roots, path, 'folder')
  }

  for (const path of filePaths) {
    addPath(roots, path, 'file')
  }

  return roots
}

function addPath(roots: SourceTreeNode[], path: string[], leafKind: SourceTreeNode['kind']) {
  let siblings = roots
  const currentPath: string[] = []

  for (const [index, name] of path.entries()) {
    currentPath.push(name)

    const kind = index === path.length - 1 ? leafKind : 'folder'
    let node = siblings.find(candidate => candidate.name === name && candidate.kind === kind)

    if (!node) {
      node = { children: [], kind, name, path: [...currentPath] }
      siblings.push(node)
    }

    siblings = node.children
  }
}
</script>

<template>
  <ul class="structure-tree" :class="{ root: currentDepth === 0 }">
    <li v-for="node in treeNodes" :key="node.path.join('/')" class="structure-tree-node">
      <div class="structure-tree-row" :title="node.path.join(' > ')">
        <i
          class="pi"
          :class="node.kind === 'file' ? 'pi-file' : currentDepth === 0 ? 'pi-folder-open' : 'pi-folder'"
          aria-hidden="true"
        />
        <span>{{ node.name }}</span>
      </div>

      <SourceStructureTree v-if="node.children.length" :depth="currentDepth + 1" :nodes="node.children" />
    </li>
  </ul>
</template>

<style scoped>
.structure-tree {
  margin: 0;
  padding: 0;
  list-style: none;
}

.structure-tree:not(.root) {
  margin-left: 8px;
  padding-left: 20px;
  border-left: 1px solid var(--kw-border-subtle);
}

.structure-tree-node {
  position: relative;
}

.structure-tree:not(.root) > .structure-tree-node::before {
  position: absolute;
  top: 14px;
  left: -20px;
  width: 14px;
  border-top: 1px solid var(--kw-border-subtle);
  content: '';
}

.structure-tree:not(.root) > .structure-tree-node:last-child::after {
  position: absolute;
  top: 15px;
  bottom: 0;
  left: -21px;
  width: 2px;
  background: var(--kw-surface);
  content: '';
}

.structure-tree-row {
  display: flex;
  min-width: 0;
  min-height: 28px;
  align-items: center;
  gap: 8px;
  color: var(--kw-text-muted);
  font-size: 0.8125rem;
  line-height: 1.25rem;
}

.structure-tree-row > i {
  width: 16px;
  flex: 0 0 16px;
  color: var(--kw-text-disabled);
  font-size: 0.875rem;
  text-align: center;
}

.structure-tree.root > .structure-tree-node > .structure-tree-row > i {
  color: var(--kw-focus);
}

.structure-tree-row > .pi-file {
  color: var(--kw-focus);
}

.structure-tree-row > span {
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>
