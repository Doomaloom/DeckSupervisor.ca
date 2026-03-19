(function () {
  const api = typeof browser !== 'undefined' ? browser : chrome

  const PRESETS = {
    jim_archdekin: {
      label: 'Jim Archdekin Recreation Centre',
      config: {
        locationLabel: 'Jim Archdekin Recreation Centre',
        season: 'Spring Swim/Skate 2026 2026',
        status: ['Booked'],
        gender: [
          '--None--',
          '(F) Female',
          '(M) Male',
          '(U) Undisclosed',
          '(X) Gender Neutral',
        ],
        show: ['Age', 'Email', 'Extras', 'Last Name', 'Medical Condition', 'Phone', 'Status'],
        sortBy: 'Name',
        header: 'None',
      },
    },
    paul_palleschi: {
      label: "Paul Palleschi Recreation Centre (Loafer's Lake)",
      config: {
        locationLabel: "Paul Palleschi Recreation Centre (Loafer's Lake)",
        season: 'Spring Swim/Skate 2026 2026',
        status: ['Booked'],
        gender: [
          '--None--',
          '(F) Female',
          '(M) Male',
          '(U) Undisclosed',
          '(X) Gender Neutral',
        ],
        show: ['Age', 'Email', 'Extras', 'Last Name', 'Medical Condition', 'Phone', 'Status'],
        sortBy: 'Name',
        header: 'None',
      },
    },
  }

  const statusElement = document.getElementById('status')
  const dateInput = document.getElementById('session-date')
  const dateButton = document.getElementById('session-date-button')
  const datePicker = document.getElementById('date-picker')
  const calendarLabel = document.getElementById('calendar-label')
  const calendarGrid = document.getElementById('calendar-grid')
  const prevMonthButton = document.getElementById('calendar-prev')
  const nextMonthButton = document.getElementById('calendar-next')
  const buttons = Array.from(document.querySelectorAll('button[data-preset]'))
  const exportModeInputs = Array.from(document.querySelectorAll('input[name="export-mode"]'))
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]
  let selectedDate = ''
  let visibleMonth = 0
  let visibleYear = 0
  let exportMode = 'single_day'

  function formatDateForStorage(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-')
  }

  function formatDateForLabel(date) {
    return `${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
  }

  function syncDateControls(nextDate) {
    selectedDate = nextDate
    if (dateInput) {
      dateInput.value = nextDate
    }
    if (dateButton) {
      if (!nextDate) {
        dateButton.textContent = 'Select date'
      } else {
        const parts = nextDate.split('-').map(Number)
        dateButton.textContent = formatDateForLabel(new Date(parts[0], parts[1] - 1, parts[2]))
      }
    }
  }

  function renderCalendar() {
    if (!calendarGrid || !calendarLabel) {
      return
    }
    calendarLabel.textContent = `${monthNames[visibleMonth]} ${visibleYear}`
    calendarGrid.innerHTML = ''

    const firstDay = new Date(visibleYear, visibleMonth, 1)
    const startOffset = firstDay.getDay()
    const daysInMonth = new Date(visibleYear, visibleMonth + 1, 0).getDate()

    for (let index = 0; index < startOffset; index += 1) {
      const spacer = document.createElement('span')
      spacer.className = 'calendar-day muted'
      spacer.setAttribute('aria-hidden', 'true')
      calendarGrid.appendChild(spacer)
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'calendar-day'
      button.textContent = String(day)
      const isoDate = formatDateForStorage(new Date(visibleYear, visibleMonth, day))
      if (isoDate === selectedDate) {
        button.classList.add('selected')
      }
      button.addEventListener('click', function () {
        syncDateControls(isoDate)
        datePicker.classList.add('hidden')
        renderCalendar()
      })
      calendarGrid.appendChild(button)
    }
  }

  if (dateInput && dateButton && datePicker && prevMonthButton && nextMonthButton) {
    const today = new Date()
    visibleMonth = today.getMonth()
    visibleYear = today.getFullYear()
    syncDateControls(formatDateForStorage(today))
    renderCalendar()

    dateButton.addEventListener('click', function () {
      datePicker.classList.toggle('hidden')
    })

    prevMonthButton.addEventListener('click', function () {
      visibleMonth -= 1
      if (visibleMonth < 0) {
        visibleMonth = 11
        visibleYear -= 1
      }
      renderCalendar()
    })

    nextMonthButton.addEventListener('click', function () {
      visibleMonth += 1
      if (visibleMonth > 11) {
        visibleMonth = 0
        visibleYear += 1
      }
      renderCalendar()
    })
  }

  exportModeInputs.forEach(input => {
    input.addEventListener('change', function () {
      if (input.checked) {
        exportMode = input.value || 'single_day'
      }
    })
  })

  function setStatus(message, tone) {
    statusElement.textContent = message
    statusElement.className = 'status' + (tone ? ' ' + tone : '')
  }

  function setBusy(isBusy) {
    buttons.forEach(button => {
      button.disabled = isBusy
    })
  }

  function getStatusSelection() {
    if (exportMode === 'planner_week' || exportMode === 'planner_two_weeks') {
      return ['Booked', 'Waiting']
    }
    return ['Booked']
  }

  function getRuntimeError() {
    return api.runtime && api.runtime.lastError ? api.runtime.lastError : null
  }

  function queryActiveTab(callback) {
    api.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const error = getRuntimeError()
      callback(error, tabs || [])
    })
  }

  function injectAutomationFile(tabId, callback) {
    if (api.scripting && typeof api.scripting.executeScript === 'function') {
      api.scripting.executeScript(
        {
          target: { tabId },
          files: ['automation.js'],
        },
        function () {
          callback(getRuntimeError())
        },
      )
      return
    }

    api.tabs.executeScript(
      tabId,
      {
        file: 'automation.js',
      },
      function () {
        callback(getRuntimeError())
      },
    )
  }

  function runAutomation(tabId, payload, callback) {
    if (api.scripting && typeof api.scripting.executeScript === 'function') {
      api.scripting.executeScript(
        {
          target: { tabId },
          func: function (config) {
            if (typeof runCsvGetterAutomation !== 'function') {
              throw new Error('CSV getter automation is not available in the active tab.')
            }
            runCsvGetterAutomation(config)
          },
          args: [payload],
        },
        function () {
          callback(getRuntimeError())
        },
      )
      return
    }

    api.tabs.executeScript(
      tabId,
      {
        code: `runCsvGetterAutomation(${JSON.stringify(payload)});`,
      },
      function () {
        callback(getRuntimeError())
      },
    )
  }

  function runPreset(presetKey) {
    const preset = PRESETS[presetKey]
    if (!preset) {
      setStatus('Preset was not found.', 'error')
      return
    }
    if (!selectedDate) {
      setStatus('Pick the first session date before running a preset.', 'error')
      return
    }

    setBusy(true)
    setStatus(`Running ${preset.label}...`)

    queryActiveTab(function (queryError, tabs) {
      if (queryError) {
        setBusy(false)
        setStatus(queryError.message || 'Failed to read the active tab.', 'error')
        return
      }

      const activeTab = tabs && tabs[0]
      if (!activeTab || typeof activeTab.id !== 'number') {
        setBusy(false)
        setStatus('No active tab was found.', 'error')
        return
      }

      const payload = {
        ...preset.config,
        sessionDate: selectedDate,
        exportMode,
        status: getStatusSelection(),
      }

      injectAutomationFile(activeTab.id, function (loadError) {
          if (loadError) {
            setBusy(false)
            setStatus(loadError.message || 'Failed to load the automation script.', 'error')
            return
          }

        runAutomation(activeTab.id, payload, function (runError) {
          setBusy(false)
          if (runError) {
            setStatus(runError.message || 'Failed to run the CSV getter preset.', 'error')
            return
          }
          setStatus(`Ran ${preset.label} in the active tab.`, 'success')
          window.setTimeout(function () {
            window.close()
          }, 900)
        })
      })
    })
  }

  buttons.forEach(button => {
    button.addEventListener('click', function () {
      runPreset(button.getAttribute('data-preset'))
    })
  })
})()
