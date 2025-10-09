import React, { useState } from 'react'

function MasterList() {
  const [instructors, setInstructors] = useState([{ name: '', codes: '' }])
  const [formatOptions, setFormatOptions] = useState({
    time_headers: false,
    instructor_headers: false,
    course_headers: false,
    borders: false,
    center_time: false,
    bold_time: false,
    center_course: false,
    bold_course: false,
  })

  const addInstructor = () => {
    setInstructors([...instructors, { name: '', codes: '' }])
  }

  const removeInstructor = (index) => {
    if (instructors.length > 1) {
      setInstructors(instructors.filter((_, i) => i !== index))
    }
  }

  const updateInstructor = (index, field, value) => {
    const updated = [...instructors]
    updated[index][field] = value
    setInstructors(updated)
  }

  const toggleOption = (option) => {
    setFormatOptions(prev => ({
      ...prev,
      [option]: !prev[option]
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    console.log('Submitting:', { instructors, formatOptions })
    // Add your form submission logic here
  }

  return (
    <div className="masterlist">
      <form onSubmit={handleSubmit}>
        <div className="drop-zone">
          <p>Drag & Drop your .csv file here or click to select</p>
          <input type="file" name="csv_file" accept=".csv" style={{ opacity: 0 }} required />
        </div>
        
        <div className="main-container">
          <div className="panel-left">
            <h2>Instructors and Classes</h2>
            <div className="instructor-fields">
              {instructors.map((instructor, index) => (
                <div key={index} className="instructor-entry">
                  <input
                    type="text"
                    placeholder="Instructor Name"
                    value={instructor.name}
                    onChange={(e) => updateInstructor(index, 'name', e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Classes (comma separated)"
                    value={instructor.codes}
                    onChange={(e) => updateInstructor(index, 'codes', e.target.value)}
                  />
                  <button type="button" className="remove-btn" onClick={() => removeInstructor(index)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="add-btn" onClick={addInstructor}>
              Add Instructor
            </button>
          </div>

          <div className="panel-right">
            <h2>Formatting Options</h2>
            <div className="option-group">
              <button 
                type="button"
                className={`option-check ${formatOptions.time_headers ? 'selected' : ''}`}
                onClick={() => toggleOption('time_headers')}
              >
                Time Headers
              </button>
              <button 
                type="button"
                className={`option-check ${formatOptions.instructor_headers ? 'selected' : ''}`}
                onClick={() => toggleOption('instructor_headers')}
              >
                Instructor Headers
              </button>
              <button 
                type="button"
                className={`option-check ${formatOptions.course_headers ? 'selected' : ''}`}
                onClick={() => toggleOption('course_headers')}
              >
                Course Headers
              </button>
              <button 
                type="button"
                className={`option-check ${formatOptions.borders ? 'selected' : ''}`}
                onClick={() => toggleOption('borders')}
              >
                Borders
              </button>
              
              <fieldset>
                <legend>Time Header Style</legend>
                <button 
                  type="button"
                  className={`option-check ${formatOptions.center_time ? 'selected' : ''}`}
                  onClick={() => toggleOption('center_time')}
                >
                  Center
                </button>
                <button 
                  type="button"
                  className={`option-check ${formatOptions.bold_time ? 'selected' : ''}`}
                  onClick={() => toggleOption('bold_time')}
                >
                  Bold
                </button>
              </fieldset>
              
              <fieldset>
                <legend>Course Header Style</legend>
                <button 
                  type="button"
                  className={`option-check ${formatOptions.center_course ? 'selected' : ''}`}
                  onClick={() => toggleOption('center_course')}
                >
                  Center
                </button>
                <button 
                  type="button"
                  className={`option-check ${formatOptions.bold_course ? 'selected' : ''}`}
                  onClick={() => toggleOption('bold_course')}
                >
                  Bold
                </button>
              </fieldset>
            </div>
          </div>
        </div>

        <div className="remember-panel">
          <button type="button" className="option-check">
            Remember Instructors and Classes
          </button>
          <button type="button" className="option-check">
            Remember Formatting Options
          </button>
        </div>

        <button type="submit" className="submit-btn">
          Create Master List
        </button>
      </form>
    </div>
  )
}

export default MasterList