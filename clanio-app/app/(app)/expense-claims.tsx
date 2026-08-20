import { ResourceList } from '@/components/ResourceList'

type Item = Record<string, any>

export default function ExpenseClaimsScreen() {
  return (
    <ResourceList<Item>
      title="Expense Claims"
      endpoint="/expense-claims"
      searchPlaceholder="Search claims"
      emptyTitle="No claims"
      emptyMessage="Reimbursement claims will appear here."
      toRow={(item) => ({
        key: String(item.uuid ?? item.id),
        title: item.employee_name ?? 'Employee',
        subtitle: (item.category_label ?? '') + ' · ' + (item.expense_date ?? ''),
        badge: item.amount != null ? '₹' + item.amount : undefined,
        meta: item.status,
        search: (item.employee_name ?? '') + ' ' + (item.purpose ?? ''),
      })}
    />
  )
}
