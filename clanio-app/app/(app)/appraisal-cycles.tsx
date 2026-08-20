import { ResourceList } from '@/components/ResourceList'

type Item = Record<string, any>

export default function AppraisalCyclesScreen() {
  return (
    <ResourceList<Item>
      title="Appraisal Cycles"
      endpoint="/appraisal-cycles"
      searchPlaceholder="Search cycles"
      emptyTitle="No cycles"
      emptyMessage="Create an appraisal cycle to start reviews."
      toRow={(item) => ({
        key: String(item.uuid ?? item.id),
        title: item.name,
        subtitle: (item.period_start ?? '') + ' to ' + (item.period_end ?? ''),
        badge: item.status,
        meta: (item.appraisal_count ?? 0) + ' reviews',
        search: (item.name ?? '') + ' ' + (item.status ?? ''),
      })}
    />
  )
}
