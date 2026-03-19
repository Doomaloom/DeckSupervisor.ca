function runCsvGetterAutomation(config) {
  const normalize = value => (value || '').replace(/\s+/g, ' ').trim()
  const parameterContainers = Array.from(document.querySelectorAll('.trv-parameter-container'))
  const missing = []
  const exportMode = config.exportMode || 'single_day'

  const findContainer = title =>
    parameterContainers.find(container => {
      const titleElement = container.querySelector('.trv-parameter-title')
      return normalize(titleElement && titleElement.textContent) === title
    })

  const getListItems = container => Array.from(container.querySelectorAll('.trv-listviewitem'))
  const getClearLink = container => container.querySelector('.trv-select-none')
  const getPreviewButton = () => document.querySelector('.trv-parameters-area-preview-button')

  const parseDateInput = rawValue => {
    const trimmed = normalize(rawValue)
    if (!trimmed) {
      return null
    }
    const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
    if (isoMatch) {
      const year = Number(isoMatch[1])
      const month = Number(isoMatch[2])
      const day = Number(isoMatch[3])
      const date = new Date(year, month - 1, day)
      if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
        return date
      }
      return null
    }
    const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (slashMatch) {
      const month = Number(slashMatch[1])
      const day = Number(slashMatch[2])
      const year = Number(slashMatch[3])
      const date = new Date(year, month - 1, day)
      if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
        return date
      }
    }
    return null
  }

  const formatDateValue = date =>
    [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-')

  const addDays = (date, dayCount) => {
    const nextDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    nextDate.setDate(nextDate.getDate() + dayCount)
    return nextDate
  }

  const getRangeEndDate = startDate => {
    if (exportMode === 'planner_week') {
      return addDays(startDate, 6)
    }
    if (exportMode === 'planner_two_weeks') {
      return addDays(startDate, 13)
    }
    return startDate
  }

  const dispatchInputEvents = input => {
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    input.dispatchEvent(new Event('blur', { bubbles: true }))
  }

  const setTextInput = (title, nextValue) => {
    const container = findContainer(title)
    const input = container && container.querySelector('input[type="text"]')
    if (!input) {
      missing.push(`Field "${title}"`)
      return
    }
    input.value = nextValue
    dispatchInputEvents(input)
  }

  const setCheckbox = (title, checked) => {
    const container = findContainer(title)
    const input = container && container.querySelector('input[type="checkbox"]')
    if (!input) {
      missing.push(`Checkbox "${title}"`)
      return
    }
    if (Boolean(input.checked) !== checked) {
      input.click()
    } else {
      input.dispatchEvent(new Event('change', { bubbles: true }))
    }
  }

  const validateListOption = (title, label) => {
    const container = findContainer(title)
    if (!container) {
      missing.push(`Filter "${title}"`)
      return
    }
    const items = getListItems(container)
    if (!items.some(item => normalize(item.textContent) === label)) {
      missing.push(`${title} option "${label}"`)
    }
  }

  const clearListSelection = title => {
    const container = findContainer(title)
    const clearLink = container && getClearLink(container)
    if (!container || !clearLink) {
      missing.push(`Clear action for "${title}"`)
      return false
    }
    clearLink.click()
    return true
  }

  const clickListOption = (title, label) => {
    const container = findContainer(title)
    const item = container
      ? getListItems(container).find(candidate => normalize(candidate.textContent) === label)
      : null
    if (!item) {
      missing.push(`${title} option "${label}"`)
      return
    }
    const selected = item.classList.contains('k-selected') || item.getAttribute('aria-selected') === 'true'
    if (!selected) {
      item.click()
    }
  }

  const setSingleSelect = (title, label) => {
    if (!clearListSelection(title)) {
      return
    }
    clickListOption(title, label)
  }

  const setMultiSelect = (title, labels) => {
    if (!clearListSelection(title)) {
      return
    }
    labels.forEach(label => {
      clickListOption(title, label)
    })
  }

  ;[
    'Search via Event ID',
    'ID',
    'From',
    'To',
    'Activity Name',
    'Supervisor',
    'Calendar',
    'Service',
    'Staff',
    'Activity Type',
    'Location',
    'Gender',
    'Season',
    'Show',
    'Status',
    'View Questionnaire Responses in Columns',
    'Sort By',
    'Header',
    'Save Filter Selection',
  ].forEach(title => {
    if (!findContainer(title)) {
      missing.push(`Filter "${title}"`)
    }
  })

  ;['All'].forEach(label => {
    validateListOption('Supervisor', label)
    validateListOption('Calendar', label)
    validateListOption('Service', label)
    validateListOption('Staff', label)
    validateListOption('Activity Type', label)
  })
  validateListOption('Location', config.locationLabel)
  validateListOption('Season', config.season)
  config.gender.forEach(label => validateListOption('Gender', label))
  config.show.forEach(label => validateListOption('Show', label))
  config.status.forEach(label => validateListOption('Status', label))
  validateListOption('Sort By', config.sortBy)
  validateListOption('Header', config.header)

  if (!getPreviewButton()) {
    missing.push('Preview button')
  }

  const parsedDate = parseDateInput(config.sessionDate)
  if (!parsedDate) {
    window.alert('A valid session start date is required in YYYY-MM-DD format.')
    return
  }

  if (!['single_day', 'planner_week', 'planner_two_weeks'].includes(exportMode)) {
    window.alert('A valid CSV export mode is required.')
    return
  }

  if (missing.length > 0) {
    window.alert(
      `CSV getter automation could not start. Missing: ${Array.from(new Set(missing)).join(', ')}`,
    )
    return
  }

  const formattedDate = formatDateValue(parsedDate)
  const formattedEndDate = formatDateValue(getRangeEndDate(parsedDate))
  setCheckbox('Search via Event ID', false)
  setTextInput('ID', '')
  setTextInput('From', formattedDate)
  setTextInput('To', formattedEndDate)
  setTextInput('Activity Name', '')
  setSingleSelect('Supervisor', 'All')
  setSingleSelect('Calendar', 'All')
  setSingleSelect('Service', 'All')
  setSingleSelect('Staff', 'All')
  setSingleSelect('Activity Type', 'All')
  setSingleSelect('Location', config.locationLabel)
  setMultiSelect('Gender', config.gender)
  setSingleSelect('Season', config.season)
  setMultiSelect('Show', config.show)
  setMultiSelect('Status', config.status)
  setCheckbox('View Questionnaire Responses in Columns', false)
  setSingleSelect('Sort By', config.sortBy)
  setSingleSelect('Header', config.header)
  setCheckbox('Save Filter Selection', true)

  if (missing.length > 0) {
    window.alert(
      `CSV getter automation could not finish. Missing: ${Array.from(new Set(missing)).join(', ')}`,
    )
    return
  }

  getPreviewButton() && getPreviewButton().click()
}
