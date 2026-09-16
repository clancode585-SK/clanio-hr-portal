import { useCallback } from 'react'
import { CrudList, type FieldSpec, type RowAction } from '@/components/CrudList'
import { apiList } from '@/lib/api'
import type { Option } from '@/components/ui/Select'

type Item = Record<string, any>

const fields: FieldSpec[] = [
  {
    key: 'title',
    label: 'Job title',
    type: 'text',
    placeholder: 'Associate Project Manager/Scrum Master (Banking Domain)',
    autoCapitalize: 'words',
    required: true,
    max: 200,
  },
  { key: 'location', label: 'Location', type: 'text', placeholder: 'Noida', autoCapitalize: 'words', required: true, max: 150 },
  {
    key: 'employment_type',
    label: 'Employment type',
    type: 'select',
    options: [
      { value: 'full_time', label: 'Full time' },
      { value: 'part_time', label: 'Part time' },
      { value: 'intern', label: 'Intern' },
      { value: 'contract', label: 'Contract' },
      { value: 'consultant', label: 'Consultant' },
    ],
    placeholder: 'Full time',
  },
  {
    key: 'work_mode',
    label: 'Work mode',
    type: 'select',
    options: [
      { value: 'onsite', label: 'From the office' },
      { value: 'hybrid', label: 'Hybrid' },
      { value: 'remote', label: 'Remote' },
    ],
    placeholder: 'From the office',
  },
  { key: 'experience_min', label: 'Experience from (years)', type: 'number', placeholder: '5', min: 0, maxValue: 50 },
  {
    key: 'experience_max',
    label: 'Experience up to (years)',
    type: 'number',
    placeholder: 'Leave blank for 5+',
    min: 0,
    maxValue: 60,
    allowClear: true,
  },
  { key: 'positions', label: 'How many positions', type: 'number', placeholder: '1', integer: true, min: 1, maxValue: 999 },
  { key: 'department_id', label: 'Department', type: 'select', optionsKey: 'departments', allowClear: true },
  { key: 'designation_id', label: 'Designation', type: 'select', optionsKey: 'designations', allowClear: true },
  { key: 'branch_id', label: 'Branch', type: 'select', optionsKey: 'branches', allowClear: true },
  {
    key: 'summary',
    label: 'One line pitch',
    type: 'text',
    placeholder: 'Lead agile delivery for core banking programs.',
    autoCapitalize: 'sentences',
    multiline: true,
    max: 500,
  },
  {
    key: 'responsibilities',
    label: 'Key responsibilities',
    type: 'text',
    placeholder: 'Lead and facilitate Sprint Planning sessions.\nFacilitate Scrum ceremonies.',
    hint: 'One point per line. These become the bullet list on your career page.',
    autoCapitalize: 'sentences',
    multiline: true,
    max: 8000,
  },
  {
    key: 'requirements',
    label: 'Required skills and qualifications',
    type: 'text',
    placeholder: '2+ years as a Scrum Master.\nStrong knowledge of Agile frameworks.',
    hint: 'One point per line.',
    autoCapitalize: 'sentences',
    multiline: true,
    max: 8000,
  },
  {
    key: 'nice_to_have',
    label: 'Good to have',
    type: 'text',
    placeholder: 'Scrum Master Certification (CSM, PSM) is an added advantage',
    hint: 'One point per line.',
    autoCapitalize: 'sentences',
    multiline: true,
    max: 4000,
  },
  { key: 'salary_min', label: 'Salary from', type: 'number', placeholder: 'Yearly, optional', min: 0, allowClear: true },
  { key: 'salary_max', label: 'Salary up to', type: 'number', placeholder: 'Yearly, optional', min: 0, allowClear: true },
  { key: 'show_salary', label: 'Show salary on the career page', type: 'toggle' },
  { key: 'closes_on', label: 'Stop accepting on', type: 'date', placeholder: 'YYYY-MM-DD', allowClear: true },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'draft', label: 'Draft, not public yet' },
      { value: 'open', label: 'Open, live on the career page' },
      { value: 'on_hold', label: 'On hold' },
      { value: 'closed', label: 'Closed' },
    ],
    placeholder: 'Draft, not public yet',
  },
]

const statusLabel: Record<string, string> = {
  draft: 'Draft',
  open: 'Live',
  on_hold: 'On hold',
  closed: 'Closed',
}

export default function OpeningsScreen() {
  const loadOptions = useCallback(async (): Promise<Record<string, Option[]>> => {
    const pull = async (path: string): Promise<Option[]> => {
      try {
        const result = await apiList<Item>(path)

        return result.data.map((row) => ({ value: String(row.id), label: row.name }))
      } catch {
        return []
      }
    }

    const [departments, designations, branches] = await Promise.all([
      pull('/departments?per_page=100'),
      pull('/designations?per_page=100'),
      pull('/branches?per_page=100'),
    ])

    return { departments, designations, branches }
  }, [])

  const actions: RowAction<Item>[] = [
    {
      key: 'applicants',
      label: 'See applicants',
      method: 'PUT',
      path: (item) => `/openings/${item.uuid}`,
      navigate: (item) => `/openings/${item.uuid}`,
      tone: 'primary',
    },
    {
      key: 'publish',
      label: 'Publish to the career page',
      method: 'PUT',
      path: (item) => `/openings/${item.uuid}`,
      body: { status: 'open' },
      permission: 'recruitment.manage',
      visible: (item) => item.status !== 'open',
      confirmLabel: 'Publish',
    },
    {
      key: 'hold',
      label: 'Put on hold',
      method: 'PUT',
      path: (item) => `/openings/${item.uuid}`,
      body: { status: 'on_hold' },
      tone: 'secondary',
      permission: 'recruitment.manage',
      visible: (item) => item.status === 'open',
    },
    {
      key: 'close',
      label: 'Close this opening',
      method: 'PUT',
      path: (item) => `/openings/${item.uuid}`,
      body: { status: 'closed' },
      tone: 'secondary',
      permission: 'recruitment.manage',
      visible: (item) => item.status !== 'closed',
    },
  ]

  return (
    <CrudList<Item>
      title="Openings"
      endpoint="/openings"
      singular="opening"
      fields={fields}
      loadOptions={loadOptions}
      rowActions={actions}
      permissions={{ create: 'recruitment.manage', edit: 'recruitment.manage', delete: 'recruitment.manage' }}
      defaults={{ status: 'draft', employment_type: 'full_time', work_mode: 'onsite', positions: '1', experience_min: '0' }}
      searchPlaceholder="Search by title or location"
      emptyTitle="No openings yet"
      emptyMessage="Add a role, write the description, then publish it to your career page."
      notice={{
        title: 'Publishing puts it on your website',
        message: 'A draft stays private. The moment you publish, it appears on your career page and people can apply.',
      }}
      screenActions={[]}
      toRow={(item) => ({
        key: String(item.uuid ?? item.id),
        title: item.title,
        subtitle: `${item.location} · ${item.experience_label} · ${statusLabel[item.status] ?? item.status}`,
        badge: item.application_count > 0 ? `${item.application_count}` : undefined,
        meta:
          item.application_count > 0
            ? `${item.open_count ?? 0} in process`
            : item.status === 'open'
              ? 'Live, no applicants yet'
              : undefined,
        search: `${item.title ?? ''} ${item.location ?? ''}`,
      })}
    />
  )
}
