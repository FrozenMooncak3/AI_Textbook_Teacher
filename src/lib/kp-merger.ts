import type {
  ClusterDef,
  FinalKP,
  ModuleGroup,
  OCRQuality,
  Stage2Result,
} from './services/kp-extraction-types'

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s\-_:/|()[\],.]+/g, ' ')
    .trim()
}

function buildBigrams(value: string): Set<string> {
  const normalized = normalizeText(value).replace(/\s+/g, '')
  if (normalized.length <= 2) {
    return new Set(normalized ? [normalized] : [])
  }

  const grams = new Set<string>()
  for (let index = 0; index < normalized.length - 1; index += 1) {
    grams.add(normalized.slice(index, index + 2))
  }

  return grams
}

function similarity(left: string, right: string): number {
  const leftNorm = normalizeText(left)
  const rightNorm = normalizeText(right)

  if (!leftNorm || !rightNorm) {
    return 0
  }

  if (leftNorm === rightNorm || leftNorm.includes(rightNorm) || rightNorm.includes(leftNorm)) {
    return 1
  }

  const leftBigrams = buildBigrams(leftNorm)
  const rightBigrams = buildBigrams(rightNorm)

  let overlap = 0
  for (const gram of leftBigrams) {
    if (rightBigrams.has(gram)) {
      overlap += 1
    }
  }

  return (2 * overlap) / (leftBigrams.size + rightBigrams.size)
}

function chooseBetterQuality(left: OCRQuality, right: OCRQuality): OCRQuality {
  const order: Record<OCRQuality, number> = {
    good: 3,
    uncertain: 2,
    damaged: 1,
  }

  return order[left] >= order[right] ? left : right
}

function buildModuleSignatureFromKPs(
  finalKnowledgePoints: FinalKP[],
  moduleGroup: number,
  clusters: ClusterDef[]
): string {
  const kpSectionNames = finalKnowledgePoints
    .filter((kp) => kp.module_group === moduleGroup)
    .map((kp) => kp.section_name)
  const clusterNames = clusters
    .filter((cluster) => cluster.module_group === moduleGroup)
    .map((cluster) => cluster.name)

  return [...new Set([...kpSectionNames, ...clusterNames])]
    .map(normalizeText)
    .filter(Boolean)
    .join(' | ')
}

interface CanonicalModule {
  groupId: number
  signature: string
}

function assignCanonicalModule(
  canonicalModules: CanonicalModule[],
  signature: string
): number {
  let bestMatch: CanonicalModule | undefined
  let bestScore = 0

  for (const canonical of canonicalModules) {
    const score = similarity(signature, canonical.signature)
    if (score > bestScore) {
      bestScore = score
      bestMatch = canonical
    }
  }

  if (bestMatch && bestScore >= 0.8) {
    return bestMatch.groupId
  }

  const newGroupId = canonicalModules.length + 1
  canonicalModules.push({ groupId: newGroupId, signature })
  return newGroupId
}

export function mergeModuleGroups(
  moduleChunks: ModuleGroup[][]
): { modules: ModuleGroup[]; mappings: Array<Map<number, number>> } {
  const canonicalModules: Array<{
    group_id: number
    title: string
    sections: Set<string>
    estimated_total_kp: number
    page_start: number | null
    page_end: number | null
    signature: string
  }> = []
  const mappings: Array<Map<number, number>> = []

  for (const chunkModules of moduleChunks) {
    const mapping = new Map<number, number>()

    for (const module_ of chunkModules) {
      const signature = [module_.title, ...module_.sections].join(' | ')

      let bestMatch: (typeof canonicalModules)[number] | undefined
      let bestScore = 0

      for (const canonical of canonicalModules) {
        const score = similarity(signature, canonical.signature)
        if (score > bestScore) {
          bestScore = score
          bestMatch = canonical
        }
      }

      if (!bestMatch || bestScore < 0.8) {
        bestMatch = {
          group_id: canonicalModules.length + 1,
          title: module_.title,
          sections: new Set(module_.sections),
          estimated_total_kp: module_.estimated_total_kp,
          page_start: module_.page_start,
          page_end: module_.page_end,
          signature,
        }
        canonicalModules.push(bestMatch)
      } else {
        module_.sections.forEach((section) => bestMatch?.sections.add(section))
        bestMatch.estimated_total_kp += module_.estimated_total_kp
        bestMatch.page_start = bestMatch.page_start === null
          ? module_.page_start
          : module_.page_start === null
            ? bestMatch.page_start
            : Math.min(bestMatch.page_start, module_.page_start)
        bestMatch.page_end = bestMatch.page_end === null
          ? module_.page_end
          : module_.page_end === null
            ? bestMatch.page_end
            : Math.max(bestMatch.page_end, module_.page_end)
      }

      mapping.set(module_.group_id, bestMatch.group_id)
    }

    mappings.push(mapping)
  }

  return {
    modules: canonicalModules.map((module_) => ({
      group_id: module_.group_id,
      title: module_.title,
      sections: [...module_.sections],
      estimated_total_kp: module_.estimated_total_kp,
      page_start: module_.page_start,
      page_end: module_.page_end,
    })),
    mappings,
  }
}

function remapWithInference(results: Stage2Result[]): Array<Map<number, number>> {
  const canonicalModules: CanonicalModule[] = []

  return results.map((result) => {
    const mapping = new Map<number, number>()
    const moduleGroups = new Set<number>()

    result.final_knowledge_points.forEach((kp) => moduleGroups.add(kp.module_group))
    result.clusters.forEach((cluster) => moduleGroups.add(cluster.module_group))

    for (const moduleGroup of moduleGroups) {
      const signature = buildModuleSignatureFromKPs(
        result.final_knowledge_points,
        moduleGroup,
        result.clusters
      )
      const canonicalId = assignCanonicalModule(canonicalModules, signature || `module-${moduleGroup}`)
      mapping.set(moduleGroup, canonicalId)
    }

    return mapping
  })
}

export function mergeChunkResults(
  results: Stage2Result[],
  moduleMappings?: Array<Map<number, number>>
): Stage2Result {
  const mappings = moduleMappings ?? remapWithInference(results)
  const mergedQualityGates = {
    all_sections_have_kp: true,
    calculation_kp_complete: true,
    c2_kp_have_signals: true,
    no_too_wide_kp: true,
    ocr_damaged_marked: true,
    cross_block_merged: true,
    module_ratio_ok: true,
  }

  const issues = new Map<string, Stage2Result['issues'][number]>()
  const finalKnowledgePoints: FinalKP[] = []
  const clusterMembership = new Map<string, Set<string>>()

  for (const [resultIndex, result] of results.entries()) {
    const mapping = mappings[resultIndex] ?? new Map<number, number>()

    for (const [gateName, passed] of Object.entries(result.quality_gates)) {
      if (!passed) {
        mergedQualityGates[gateName as keyof typeof mergedQualityGates] = false
      }
    }

    for (const issue of result.issues) {
      issues.set(`${issue.kp_code}:${issue.issue}`, issue)
    }

    for (const kp of result.final_knowledge_points) {
      const canonicalModuleGroup = mapping.get(kp.module_group) ?? kp.module_group
      const duplicate = finalKnowledgePoints.find((existing) => (
        existing.module_group === canonicalModuleGroup &&
        similarity(
          `${existing.description} ${existing.detailed_content}`,
          `${kp.description} ${kp.detailed_content}`
        ) >= 0.8
      ))

      if (duplicate) {
        duplicate.importance = Math.max(duplicate.importance, kp.importance)
        duplicate.ocr_quality = chooseBetterQuality(duplicate.ocr_quality, kp.ocr_quality)
        continue
      }

      finalKnowledgePoints.push({
        ...kp,
        module_group: canonicalModuleGroup,
      })
    }
  }

  finalKnowledgePoints.sort((left, right) => {
    if (left.module_group !== right.module_group) {
      return left.module_group - right.module_group
    }

    return left.section_name.localeCompare(right.section_name)
  })

  finalKnowledgePoints.forEach((kp, index) => {
    kp.kp_code = `KP-${index + 1}`
    const clusterKey = `${kp.module_group}:${normalizeText(kp.cluster_name) || kp.cluster_name}`
    if (!clusterMembership.has(clusterKey)) {
      clusterMembership.set(clusterKey, new Set())
    }

    clusterMembership.get(clusterKey)?.add(kp.kp_code)
  })

  const clusters = [...clusterMembership.entries()]
    .map(([key, kpCodes]) => {
      const [moduleGroupValue] = key.split(':', 1)
      const moduleGroup = Number(moduleGroupValue)
      const sample = finalKnowledgePoints.find((kp) => (
        kp.module_group === moduleGroup &&
        `${kp.module_group}:${normalizeText(kp.cluster_name) || kp.cluster_name}` === key
      ))

      return {
        module_group: moduleGroup,
        name: sample?.cluster_name ?? 'Cluster',
        kp_codes: [...kpCodes],
      }
    })
    .sort((left, right) => {
      if (left.module_group !== right.module_group) {
        return left.module_group - right.module_group
      }

      return left.name.localeCompare(right.name)
    })

  return {
    quality_gates: mergedQualityGates,
    issues: [...issues.values()],
    final_knowledge_points: finalKnowledgePoints,
    clusters,
  }
}
