import React, { useState } from 'react'

function Rosters() {
  const [multiSelect, setMultiSelect] = useState(false)

  return (
    <div className="rosters">
      <div className="button-and-content">
        <div className="buttons">
          <button type="button" className="btn">Print All</button>
          <button type="button" className="btn">Clear All</button>
          <button 
            type="button" 
            className={`option-check ${multiSelect ? 'selected' : ''}`}
            onClick={() => setMultiSelect(!multiSelect)}
          >
            Multi-Select
          </button>
        </div>
        
        <div className="selected-options">
          <select className="instructor-select">
            <option value="">Filter Classes by Instructor</option>
          </select>
          <select className="level-select" disabled>
            <option value="">Change All Selected Levels</option>
          </select>
          <select className="instructor-select">
            <option value="">Change All Selected Instructors</option>
          </select>
        </div>
        
        <div className="main-content">
          <div className="rosters-container">
            <p>No rosters loaded. Upload a CSV file to see rosters.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Rosters