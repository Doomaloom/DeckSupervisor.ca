import React from 'react'

function Schematic() {
  return (
    <div className="schematic">
      <div className="schematic-container">
        <div className="time-sidebar" id="time-sidebar-left">
          {/* Time labels will be generated here */}
        </div>
        
        <div className="main-content" id="main-content">
          {/* Columns will be dynamically generated here */}
          <p>No schedule data loaded. Upload a CSV file to generate the schedule.</p>
        </div>
        
        <div className="time-sidebar" id="time-sidebar-right">
          {/* Time labels will be generated here */}
        </div>
      </div>
      
      <div className="schematic-actions">
        <button className="btn">Save Schedule</button>
      </div>
    </div>
  )
}

export default Schematic