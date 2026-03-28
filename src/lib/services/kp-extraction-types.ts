export interface Section {
  title: string
  line_start: number
  line_end: number
  page_start: number | null
  page_end: number | null
  estimated_kp_count: number
  module_group: number
}

export interface ModuleGroup {
  group_id: number
  title: string
  sections: string[]
  estimated_total_kp: number
  page_start: number | null
  page_end: number | null
}

export interface Stage0Result {
  sections: Section[]
  modules: ModuleGroup[]
}

export type KPType = 'position' | 'calculation' | 'c1_judgment' | 'c2_evaluation' | 'definition'
export type OCRQuality = 'good' | 'uncertain' | 'damaged'

export interface RawKP {
  kp_code: string
  section_name: string
  description: string
  type: KPType
  importance: number
  detailed_content: string
  cross_block_risk: boolean
  ocr_quality: OCRQuality
}

export interface Stage1Result {
  knowledge_points: RawKP[]
}

export interface QualityGates {
  all_sections_have_kp: boolean
  calculation_kp_complete: boolean
  c2_kp_have_signals: boolean
  no_too_wide_kp: boolean
  ocr_damaged_marked: boolean
  cross_block_merged: boolean
  module_ratio_ok: boolean
}

export interface QualityIssue {
  kp_code: string
  issue: string
  suggestion: string
}

export interface FinalKP {
  kp_code: string
  module_group: number
  cluster_name: string
  section_name: string
  description: string
  type: KPType
  importance: number
  detailed_content: string
  ocr_quality: OCRQuality
}

export interface ClusterDef {
  module_group: number
  name: string
  kp_codes: string[]
}

export interface Stage2Result {
  quality_gates: QualityGates
  issues: QualityIssue[]
  final_knowledge_points: FinalKP[]
  clusters: ClusterDef[]
}

export interface ModuleMapKP {
  id: number
  kp_code: string
  description: string
  type: KPType
  importance: number
  cluster_name: string | null
  ocr_quality: OCRQuality
}

export interface ModuleMapCluster {
  id: number
  name: string
  kp_count: number
}

export interface ModuleMapModule {
  id: number
  title: string
  summary: string
  order_index: number
  kp_count: number
  cluster_count: number
  page_start: number | null
  page_end: number | null
  knowledge_points: ModuleMapKP[]
  clusters: ModuleMapCluster[]
}

export interface ModuleMapResponse {
  book_id: number
  book_title: string
  kp_extraction_status: string
  total_kp_count: number
  total_module_count: number
  modules: ModuleMapModule[]
}
