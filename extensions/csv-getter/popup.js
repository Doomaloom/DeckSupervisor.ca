(function () {
  const api = typeof browser !== 'undefined' ? browser : chrome

  const LOCATION_STORAGE_KEY = 'csvGetterSelectedLocation'
  const FAVORITE_LOCATIONS_STORAGE_KEY = 'csvGetterFavoriteLocations'
  const LOCATION_OPTIONS = [
    'All',
    '175 Sandalwood Pkwy',
    '8 Nelson',
    'Alderlea',
    'Balmoral Recreation Centre',
    'Baseball Diamonds',
    'Batsman Park',
    'Bob Callahan Flower City Seniors Centre',
    'Bramalea Limited Community Park',
    'Brampton Curling Club',
    'Brampton Memorial Arena',
    'Brampton Sports Park',
    'CAA Centre',
    'Carabram Park',
    'Cassie Campbell Community Centre',
    'Central Public School Recreation and Arts Centre',
    'Century Gardens Recreation Centre',
    'Chinguacousy Park Mini Golf',
    'Chinguacousy Park Outdoor Spaces',
    'Chinguacousy Park Pavilion',
    'Chinguacousy Park Sandra Hames Centre',
    'Chinguacousy Park Ski Chalet',
    'Chinguacousy Wellness Centre',
    'Chris Gibson Recreation Centre',
    'Churchville',
    'City Hall',
    'City Hall West Tower',
    'Civic Centre',
    'Collaborative Learning Technology Centre',
    'Creditview Sandalwood',
    'Dixie Sandalwood Park',
    'Downtown Main Street',
    'Dufferin-Peel Catholic District School Board',
    'Earnscliffe Recreation Centre',
    'Ebenezer Community Hall',
    'Eldorado Park',
    'Ellen Mitchell Recreation Centre',
    'Emancipation Park (Dixie 407 Sports Park)',
    'Fire/Life Safety Education Centre',
    'Flower City Community Campus - Administration (D)',
    'Flower City Community Campus - Administration (E)',
    'Flower City Community Campus - Building Division',
    'Flower City Community Campus - Lawn Bowling',
    'Flower City Community Campus - Outdoor Spaces',
    'Fred Kline Park',
    'Gage Park',
    'Gore Bocce Club',
    'Gore Meadows Community Centre',
    'Greenbriar Recreation Centre',
    'Historic Bovaird House',
    'Huttonville Community Centre',
    'Jim Archdekin Recreation Centre',
    'Ken Giles Rec Centre - Flower City Gymnastics Club',
    'Knightsbridge Community/Senior Citizen Centre',
    'McMurchy Youth Centre for Sports Excellence',
    'Mount Pleasant Community Centre',
    'Norton Place Park Community Centre',
    'Parks and Outdoor Sports',
    "Paul Palleschi Recreation Centre (Loafer's Lake)",
    'Peel District School Board',
    'Peel Village Golf Course',
    "Professor's Lake Recreation Centre",
    'Property (Facility Services)',
    'Provincial Offenses Offices',
    'Recreation Virtual Programs',
    'Riverstone Community Centre',
    'Rosalea Winter Tennis Facility',
    'Sandalwood Park',
    'Sandalwood Transit Facility',
    'Save Max Sports Centre (Brampton Soccer Centre)',
    'SB - Mobile Location (In Person)',
    'SB Contact Centre Phone',
    'Sesquicentennial Park',
    'Snelgrove Community Centre',
    'Sportsfields',
    "Susan Fennell Sportsplex (South Fletcher's)",
    'Tennis Courts',
    'Teramoto Park',
    'Terry Miller Recreation Centre',
    'Victoria Park Arena',
    'Wellington Street West',
    'William Parkway Operations Centre',
  ]
  const DEFAULT_CONFIG = {
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
  }

  const statusElement = document.getElementById('status')
  const locationSelect = document.getElementById('location-select')
  const favoriteToggleButton = document.getElementById('favorite-toggle')
  const favoriteSection = document.getElementById('favorite-section')
  const favoriteActions = document.getElementById('favorite-actions')
  const runButton = document.getElementById('run-preset')
  const dateInput = document.getElementById('session-date')
  const dateButton = document.getElementById('session-date-button')
  const datePicker = document.getElementById('date-picker')
  const calendarLabel = document.getElementById('calendar-label')
  const calendarGrid = document.getElementById('calendar-grid')
  const prevMonthButton = document.getElementById('calendar-prev')
  const nextMonthButton = document.getElementById('calendar-next')
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

  function normalizeFavoriteLocations(locations) {
    return locations.filter(location => LOCATION_OPTIONS.includes(location))
  }

  function getStoredFavoriteLocations() {
    try {
      const rawValue = window.localStorage.getItem(FAVORITE_LOCATIONS_STORAGE_KEY)
      if (!rawValue) {
        return []
      }
      const parsed = JSON.parse(rawValue)
      if (!Array.isArray(parsed)) {
        return []
      }
      return normalizeFavoriteLocations(
        parsed.filter(location => typeof location === 'string').map(location => location.trim()),
      )
    } catch (_error) {
      return []
    }
  }

  function storeFavoriteLocations(locations) {
    try {
      window.localStorage.setItem(
        FAVORITE_LOCATIONS_STORAGE_KEY,
        JSON.stringify(normalizeFavoriteLocations(locations)),
      )
    } catch (_error) {
      // Ignore storage failures inside the popup.
    }
  }

  function getFavoriteLocations() {
    return getStoredFavoriteLocations()
  }

  function getStoredLocation() {
    try {
      return window.localStorage.getItem(LOCATION_STORAGE_KEY) || ''
    } catch (_error) {
      return ''
    }
  }

  function storeLocation(location) {
    try {
      window.localStorage.setItem(LOCATION_STORAGE_KEY, location)
    } catch (_error) {
      // Ignore storage failures inside the popup.
    }
  }

  function setSelectedLocation(location) {
    if (!locationSelect) {
      return
    }
    locationSelect.value = location
    storeLocation(location)
    updateFavoriteToggle()
  }

  function renderFavoriteButtons() {
    if (!favoriteSection || !favoriteActions) {
      return
    }

    const favorites = getFavoriteLocations()
    favoriteActions.innerHTML = ''
    favoriteSection.classList.toggle('hidden', favorites.length === 0)

    favorites.forEach(location => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'secondary-button'
      button.textContent = location
      button.addEventListener('click', function () {
        setSelectedLocation(location)
        runPreset(location)
      })
      favoriteActions.appendChild(button)
    })
  }

  function updateFavoriteToggle() {
    if (!favoriteToggleButton || !locationSelect) {
      return
    }

    const selectedLocation = locationSelect.value.trim()
    const isFavorite = Boolean(selectedLocation) && getFavoriteLocations().includes(selectedLocation)
    favoriteToggleButton.disabled = !selectedLocation
    favoriteToggleButton.textContent = isFavorite ? 'Remove Favorite' : 'Add Favorite'
    favoriteToggleButton.classList.toggle('is-favorite', isFavorite)
  }

  function renderLocationOptions() {
    if (!locationSelect) {
      return
    }

    const selectedLocation = locationSelect.value || getStoredLocation() || ''
    const favoriteLocations = getFavoriteLocations()
    const orderedLocations = favoriteLocations.concat(
      LOCATION_OPTIONS.filter(location => !favoriteLocations.includes(location)),
    )

    locationSelect.innerHTML = '<option value="">Select a location</option>'
    orderedLocations.forEach(location => {
      const option = document.createElement('option')
      option.value = location
      option.textContent = location
      locationSelect.appendChild(option)
    })

    if (selectedLocation && LOCATION_OPTIONS.includes(selectedLocation)) {
      locationSelect.value = selectedLocation
    }
    updateFavoriteToggle()
  }

  function toggleCurrentFavorite() {
    if (!locationSelect) {
      return
    }

    const selectedLocation = locationSelect.value.trim()
    if (!selectedLocation) {
      return
    }

    const favorites = getFavoriteLocations()
    const nextFavorites = favorites.includes(selectedLocation)
      ? favorites.filter(location => location !== selectedLocation)
      : favorites.concat(selectedLocation)

    storeFavoriteLocations(nextFavorites)
    renderLocationOptions()
    renderFavoriteButtons()
    setSelectedLocation(selectedLocation)
  }

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
    if (runButton) {
      runButton.disabled = isBusy
    }
    if (favoriteToggleButton) {
      favoriteToggleButton.disabled = isBusy || !(locationSelect && locationSelect.value.trim())
    }
    if (locationSelect) {
      locationSelect.disabled = isBusy
    }
    if (dateButton) {
      dateButton.disabled = isBusy
    }
    exportModeInputs.forEach(input => {
      input.disabled = isBusy
    })
    if (favoriteActions) {
      Array.from(favoriteActions.querySelectorAll('button')).forEach(button => {
        button.disabled = isBusy
      })
    }
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

  function runPreset(locationOverride) {
    const selectedLocation = (locationOverride || (locationSelect ? locationSelect.value : '')).trim()
    if (!selectedLocation) {
      setStatus('Choose a location before running the helper.', 'error')
      return
    }
    if (!selectedDate) {
      setStatus('Pick the first session date before running the helper.', 'error')
      return
    }

    storeLocation(selectedLocation)
    setBusy(true)
    setStatus(`Running ${selectedLocation}...`)

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
        ...DEFAULT_CONFIG,
        locationLabel: selectedLocation,
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
          setStatus(`Ran ${selectedLocation} in the active tab.`, 'success')
          window.setTimeout(function () {
            window.close()
          }, 900)
        })
      })
    })
  }

  renderLocationOptions()
  renderFavoriteButtons()

  if (locationSelect) {
    locationSelect.addEventListener('change', function () {
      storeLocation(locationSelect.value)
      updateFavoriteToggle()
    })
  }

  if (favoriteToggleButton) {
    favoriteToggleButton.addEventListener('click', function () {
      toggleCurrentFavorite()
    })
  }

  if (runButton) {
    runButton.addEventListener('click', function () {
      runPreset()
    })
  }
})()
