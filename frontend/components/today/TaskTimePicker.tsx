// components/today/TaskTimePicker.tsx
import { useState } from 'react'
import modalStyles from '@/design-system/Modal.module.css'

interface TaskTimePickerProps {
  value:     string
  deadlineId: string
  hintId:     string
  isDraft?:   boolean
  onChange:   (value: string) => void
}

const HOURS_PER_DAY    = 24
const MINUTES_PER_HOUR = 60
const DEFAULT_HOUR     = 9   // default hour when opening the picker with no prior value

export function TaskTimePicker({ value, deadlineId, hintId, isDraft, onChange }: TaskTimePickerProps) {
  const [open,   setOpen]   = useState(false)
  const [hour,   setHour]   = useState(DEFAULT_HOUR)
  const [minute, setMinute] = useState(0)

  function openPicker() {
    const match = value.match(/^(\d{2}):(\d{2})$/)
    setHour(match ? parseInt(match[1], 10) : DEFAULT_HOUR)
    setMinute(match ? parseInt(match[2], 10) : 0)
    setOpen(true)
  }

  function confirm() {
    onChange(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`)
    setOpen(false)
  }

  function clear() {
    onChange('')
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        id={deadlineId}
        className={`${modalStyles.timePickerTrigger}${open ? ` ${modalStyles.timePickerTriggerActive}` : ''}`}
        onClick={open ? () => setOpen(false) : openPicker}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-describedby={hintId}
        data-draft={isDraft || undefined}
      >
        {value || 'Nessuno'}
      </button>

      {open && (
        <div className={modalStyles.timePickerPanel} role="group" aria-label="Seleziona orario limite">
          <div className={modalStyles.timePickerSelects}>
            <label className={modalStyles.timePickerSelectLabel}>
              <span className={modalStyles.timePickerUnit}>Ore</span>
              <select
                className={modalStyles.timePickerSelect}
                value={hour}
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                onChange={e => setHour(Number(e.target.value))}
              >
                {Array.from({ length: HOURS_PER_DAY }, (_, i) => (
                  <option key={i} value={i} style={{ color: '#1a1a1a', background: '#ffffff' }}>
                    {String(i).padStart(2, '0')}
                  </option>
                ))}
              </select>
            </label>
            <span className={modalStyles.timePickerSep} aria-hidden="true">:</span>
            <label className={modalStyles.timePickerSelectLabel}>
              <span className={modalStyles.timePickerUnit}>Min</span>
              <select
                className={modalStyles.timePickerSelect}
                value={minute}
                onChange={e => setMinute(Number(e.target.value))}
              >
                {Array.from({ length: MINUTES_PER_HOUR }, (_, i) => (
                  <option key={i} value={i} style={{ color: '#1a1a1a', background: '#ffffff' }}>
                    {String(i).padStart(2, '0')}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className={modalStyles.timePickerActions}>
            <button type="button" className={modalStyles.cancelBtn} onClick={clear}>Rimuovi</button>
            <button type="button" className={modalStyles.primaryBtn} onClick={confirm}>Conferma</button>
          </div>
        </div>
      )}
    </>
  )
}
