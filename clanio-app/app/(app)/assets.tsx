import { ResourceList } from '@/components/ResourceList'

type Item = Record<string, any>

export default function AssetsScreen() {
  return (
    <ResourceList<Item>
      title="IT Assets"
      endpoint="/assets"
      searchPlaceholder="Search assets"
      emptyTitle="No assets"
      emptyMessage="Laptops and devices you track will appear here."
      toRow={(item) => ({
        key: String(item.uuid ?? item.id),
        title: item.name,
        subtitle: (item.category_label ?? '') + ' · ' + (item.employee_name ?? 'Unassigned'),
        badge: item.asset_code,
        meta: item.status,
        search: (item.name ?? '') + ' ' + (item.asset_code ?? ''),
      })}
    />
  )
}
