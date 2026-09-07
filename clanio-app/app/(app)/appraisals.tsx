import { CrudList, type FieldSpec, type RowAction } from '@/components/CrudList'

type Item = Record<string, any>

const fields: FieldSpec[] = []

function scaleOf(item: Item): number {
  return Number(item.cycle?.rating_scale ?? item.rating_scale ?? 5)
}

function ratingPrompt(item: Item, commentLabel: string): FieldSpec[] {
  const scale = scaleOf(item)

  return [
    {
      key: 'rating',
      label: `Rating out of ${scale}`,
      type: 'number',
      placeholder: String(Math.ceil(scale * 0.8)),
      required: true,
      min: 1,
      maxValue: scale,
    },
    {
      key: 'comments',
      label: commentLabel,
      type: 'text',
      placeholder: 'Be specific',
      autoCapitalize: 'sentences',
      multiline: true,
      max: 2000,
    },
  ]
}

const rowActions: RowAction<Item>[] = [
  {
    key: 'self',
    label: 'Write my self review',
    promptTitle: 'Rate your own year',
    confirmLabel: 'Submit self review',
    method: 'PUT',
    tone: 'primary',
    path: (item) => `/appraisals/${item.uuid ?? item.id}/self-review`,
    visible: (item) => item.status === 'pending',
    prompt: (item) => ratingPrompt(item, 'What went well and what did not'),
  },
  {
    key: 'manager',
    label: 'Write manager review',
    promptTitle: 'Rate this person',
    confirmLabel: 'Submit review',
    method: 'PUT',
    path: (item) => `/appraisals/${item.uuid ?? item.id}/manager-review`,
    visible: (item) => item.status === 'self_done',
    prompt: (item) => ratingPrompt(item, 'Feedback'),
  },
  {
    key: 'finalise',
    label: 'Finalise the rating',
    promptTitle: 'Lock this rating',
    confirmLabel: 'Finalise',
    method: 'PUT',
    permission: 'performance.finalise',
    path: (item) => `/appraisals/${item.uuid ?? item.id}/finalise`,
    visible: (item) => item.status === 'manager_done',
    prompt: (item) => ratingPrompt(item, 'Closing note'),
  },
]

export default function AppraisalsScreen() {
  return (
    <CrudList<Item>
      title="Appraisals"
      endpoint="/appraisals"
      singular="appraisal"
      fields={fields}
      rowActions={rowActions}
      allowCreate={false}
      allowUpdate={false}
      searchPlaceholder="Search by employee"
      emptyTitle="No appraisals"
      emptyMessage="Launch a cycle and every employee gets one here."
      notice={{
        title: 'The cycle controls the stage',
        message: 'Self review first. Manager reviews only open once the cycle is moved to Manager review from Appraisal Cycles.',
      }}
      toRow={(item) => ({
        key: String(item.uuid ?? item.id),
        title: item.employee?.user?.name ?? item.employee_name ?? 'Employee',
        subtitle: item.cycle?.name ?? item.cycle_name ?? undefined,
        badge: item.final_rating != null ? `${item.final_rating} / ${scaleOf(item)}` : undefined,
        meta: item.status,
        search: `${item.employee?.user?.name ?? item.employee_name ?? ''} ${item.cycle?.name ?? ''}`,
      })}
    />
  )
}
