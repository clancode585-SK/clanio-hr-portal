import { ApprovalList, type Action, type Bulk, type Detail, type FileRef, type Row } from '@/components/ApprovalList'
import { useAuth } from '@/lib/auth'

type Item = Record<string, any>

const payTogether: Bulk<Item> = {
  label: 'Pay many',
  title: 'Pay these together',
  confirmLabel: 'Pay now',
  path: '/expense-claims/pay-many',
  listKey: 'claims',
  permission: 'expense.pay',
  idOf: (item) => String(item.uuid),
  eligible: (item) => item.status === 'verified' || item.status === 'approved',
  extra: [
    { key: 'payment_mode', label: 'Paid by', placeholder: 'bank_transfer, upi, cash or payroll', required: true },
    { key: 'payment_reference', label: 'Reference', placeholder: 'NEFT or UTR number' },
  ],
}

export default function ExpenseClaimsScreen() {
  const { can } = useAuth()
  const canVerify = can('expense.verify')
  const canPay = can('expense.pay')

  return (
    <ApprovalList<Item>
      title="Expense Claims"
      endpoint="/expense-claims"
      searchPlaceholder="Search claims"
      emptyTitle="No claims"
      emptyMessage="Reimbursement claims will appear here."
      filters={[
        { key: 'pending', label: 'Pending', test: (item) => item.status === 'pending' },
        { key: 'approved', label: 'Approved', test: (item) => item.status === 'approved' },
        { key: 'verified', label: 'Verified', test: (item) => item.status === 'verified' },
        { key: 'paid', label: 'Paid', test: (item) => item.status === 'paid' },
      ]}
      toRow={(item): Row => ({
        key: String(item.uuid ?? item.id),
        title: item.employee_name ?? 'Employee',
        subtitle: `${item.category_label ?? item.category} · ${item.expense_date}`,
        badge: item.amount != null ? `₹${item.amount}` : undefined,
        meta: item.status,
        search: `${item.employee_name ?? ''} ${item.purpose ?? ''} ${item.status ?? ''}`,
      })}
      bulk={payTogether}
      detailPath={(item) => `/expense-claims/${item.uuid ?? item.id}`}
      toFiles={(item): FileRef[] =>
        (item.bills ?? []).map((bill: Record<string, any>) => ({
          id: String(bill.uuid ?? bill.id),
          label: bill.original_name ?? 'Bill',
          path: `/expense-bills/${bill.uuid ?? bill.id}/download`,
          fileName: bill.original_name ?? 'bill.pdf',
        }))
      }
      toDetails={(item): Detail[] => [
        { label: 'Category', value: item.category_label ?? item.category ?? '—' },
        { label: 'Purpose', value: item.purpose ?? '—' },
        { label: 'Date', value: item.expense_date ?? '—' },
        { label: 'Claimed', value: item.amount != null ? `₹${item.amount}` : '—' },
        { label: 'Approved', value: item.approved_amount != null ? `₹${item.approved_amount}` : '—' },
        { label: 'Payable', value: item.payable_amount != null ? `₹${item.payable_amount}` : '—' },
        { label: 'Detail', value: item.description ?? '—' },
        { label: 'Bills', value: String(item.bill_count ?? item.bills?.length ?? 0) },
        { label: 'Status', value: item.status ?? '—' },
      ]}
      toActions={(item): Action[] => {
        const id = item.uuid ?? item.id

        if (item.status === 'pending' && canVerify) {
          return [
            { key: 'approve', label: 'Approve', tone: 'primary', path: `/expense-claims/${id}/approve`, remarks: 'optional' },
            {
              key: 'reject',
              label: 'Reject',
              tone: 'danger',
              path: `/expense-claims/${id}/reject`,
              remarks: 'required',
              remarksKey: 'reason',
              remarksLabel: 'Reason',
            },
          ]
        }

        if (item.status === 'approved' && canVerify) {
          return [
            { key: 'verify', label: 'Verify full amount', tone: 'primary', path: `/expense-claims/${id}/verify`, remarks: 'optional' },
            {
              key: 'reject',
              label: 'Reject',
              tone: 'danger',
              path: `/expense-claims/${id}/reject`,
              remarks: 'required',
              remarksKey: 'reason',
              remarksLabel: 'Reason',
            },
          ]
        }

        if (item.status === 'verified' && canPay) {
          return [
            {
              key: 'pay',
              label: 'Mark as paid',
              tone: 'primary',
              path: `/expense-claims/${id}/pay`,
              remarks: 'optional',
              remarksKey: 'payment_remarks',
              body: { payment_mode: 'bank_transfer' },
            },
          ]
        }

        return []
      }}
    />
  )
}
