
import { useEffect, useState } from "react";
import "./App.css";

const API = "http://localhost:3000/api";

function App() {
  const [page, setPage] = useState("Dashboard");
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [studentId, setStudentId] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [profileMessage, setProfileMessage] = useState("");

  const [student, setStudent] = useState({
    name: "",
    email: "",
    department: "CSE",
    year: "2027",
  });

  const navItems = [
    "Dashboard",
    "Find Jobs",
    "My Applications",
    "My Profile",
  ];

  // Load jobs and restore the previously registered student.
  useEffect(() => {
    async function loadData() {
      try {
        const jobsResponse = await fetch(`${API}/jobs`);
        if (!jobsResponse.ok) throw new Error("Unable to load jobs.");

        const jobsData = await jobsResponse.json();
        const jobList = Array.isArray(jobsData)
          ? jobsData
          : jobsData.jobs;

        if (!Array.isArray(jobList)) {
          throw new Error("Invalid jobs response.");
        }

        setJobs(
          jobList.map((job) => ({
            id: job.id,
            company: job.company_name,
            role: job.job_title,
            location: job.location || "Not specified",
            type: job.job_title?.toLowerCase().includes("intern")
              ? "Internship"
              : "Full-time",
            description: job.description || "",
          }))
        );

        const savedEmail = localStorage.getItem("placementStudentEmail");
        if (savedEmail) {
          await restoreStudent(savedEmail);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Find an existing student by email and restore their application history.
  async function restoreStudent(email) {
    const response = await fetch(`${API}/students`);
    if (!response.ok) throw new Error("Unable to load student records.");

    const data = await response.json();
    const students = Array.isArray(data) ? data : data.students;

    if (!Array.isArray(students)) {
      throw new Error("Unexpected student API response.");
    }

    const existing = students.find(
      (item) => item.email?.toLowerCase() === email.trim().toLowerCase()
    );

    if (!existing) {
      throw new Error("No student record was found for this email.");
    }

    setStudentId(existing.id);
    setStudent({
      name: existing.name || "",
      email: existing.email || "",
      department: existing.department || "CSE",
      year: String(existing.graduation_year || "2027"),
    });

    localStorage.setItem("placementStudentEmail", existing.email);

    const responseApps = await fetch(`${API}/applications`);
    if (!responseApps.ok) {
      throw new Error("Unable to load application history.");
    }

    const appsData = await responseApps.json();
    const allApps = Array.isArray(appsData)
      ? appsData
      : appsData.applications;

    if (!Array.isArray(allApps)) {
      throw new Error("Unexpected applications API response.");
    }

    setApplications(
      allApps
        .filter((item) => Number(item.student_id) === Number(existing.id))
        .map((item) => ({
          id: item.id,
          job_id: item.job_id,
          company_name: item.company_name,
          job_title: item.job_title,
          location: item.location || "Not specified",
          status: item.status || "Applied",
          applied_at: item.applied_at,
        }))
    );

    return existing;
  }

  // Register a new student or restore an existing student.
  async function saveProfile(event) {
    event.preventDefault();
    setProfileMessage("");
    setSaving(true);

    const email = student.email.trim();
    const year = Number(student.year);

    try {
      if (!student.name.trim() || !email) {
        throw new Error("Please enter your name and email.");
      }

      if (!Number.isInteger(year) || year < 2020 || year > 2100) {
        throw new Error("Please enter a valid graduation year.");
      }

      const response = await fetch(`${API}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: student.name.trim(),
          email,
          department: student.department,
          graduation_year: year,
        }),
      });

      const data = await response.json();

      if (response.ok && data.id) {
        setStudentId(data.id);
        localStorage.setItem("placementStudentEmail", email);

        setStudent((previous) => ({
          ...previous,
          name: previous.name.trim(),
          email,
          year: String(year),
        }));

        await loadMyApplications(data.id);
        setProfileMessage("Profile saved successfully!");
        return;
      }

      // A duplicate email means the student may already exist.
      if (response.status === 409) {
        const existing = await restoreStudent(email);

        setProfileMessage(
          `Welcome back, ${existing.name}! Your existing profile and application history have been loaded.`
        );
        return;
      }

      throw new Error(data.error || "Unable to save your profile.");
    } catch (err) {
      setProfileMessage(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function loadMyApplications(id) {
    const response = await fetch(`${API}/applications`);
    if (!response.ok) throw new Error("Unable to load applications.");

    const data = await response.json();
    const allApps = Array.isArray(data) ? data : data.applications;

    if (!Array.isArray(allApps)) {
      throw new Error("Unexpected applications API response.");
    }

    setApplications(
      allApps
        .filter((item) => Number(item.student_id) === Number(id))
        .map((item) => ({
          id: item.id,
          job_id: item.job_id,
          company_name: item.company_name,
          job_title: item.job_title,
          location: item.location || "Not specified",
          status: item.status || "Applied",
          applied_at: item.applied_at,
        }))
    );
  }

  async function applyForJob(job) {
    if (!studentId) {
      setProfileMessage(
        "Enter your registered email in My Profile to restore your account."
      );
      setPage("My Profile");
      return;
    }

    if (
      applications.some(
        (item) => Number(item.job_id) === Number(job.id)
      )
    ) {
      setProfileMessage("You have already applied for this job.");
      return;
    }

    setProfileMessage("");

    try {
      const response = await fetch(`${API}/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentId,
          job_id: job.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to submit application.");
      }

      await loadMyApplications(studentId);
      setProfileMessage(`Application submitted to ${job.company}!`);
    } catch (err) {
      setProfileMessage(err.message);
    }
  }

  const visibleJobs = jobs.filter((job) =>
    `${job.company} ${job.role} ${job.location}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  function JobList({ items }) {
    if (!items.length) return <p className="empty">No jobs found.</p>;

    return (
      <div className="job-list">
        {items.map((job) => {
          const applied = applications.some(
            (item) => Number(item.job_id) === Number(job.id)
          );

          return (
            <article className="job-card" key={job.id}>
              <div className="job-heading">
                <div>
                  <h3>{job.role}</h3>
                  <p className="company">{job.company}</p>
                </div>
                <span className="job-type">{job.type}</span>
              </div>

              <p className="location">📍 {job.location}</p>
              {job.description && <p>{job.description}</p>}

              <button
                className="primary-button"
                disabled={applied}
                onClick={() => applyForJob(job)}
              >
                {applied ? "Applied" : "Apply Now"}
              </button>
            </article>
          );
        })}
      </div>
    );
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">SP</div>
          <div>
            <h2>PlaceTrack</h2>
            <p>Placement Portal</p>
          </div>
        </div>

        <p className="nav-label">MAIN MENU</p>

        <nav>
          {navItems.map((item) => (
            <button
              key={item}
              className={`nav-item ${page === item ? "active" : ""}`}
              onClick={() => {
                setPage(item);
                setProfileMessage("");
              }}
            >
              {item === "Dashboard" && "▦"}
              {item === "Find Jobs" && "⌕"}
              {item === "My Applications" && "▤"}
              {item === "My Profile" && "♙"}
              <span>{item}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="student-avatar">
            {student.name.trim()
              ? student.name.trim().charAt(0).toUpperCase()
              : "S"}
          </div>
          <div>
            <strong>{student.name || "Student"}</strong>
            <p>{student.department} Student</p>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">STUDENT PLACEMENT MANAGEMENT</p>
            <h1>{page}</h1>
          </div>
          <button
            className="profile-button"
            onClick={() => setPage("My Profile")}
          >
            {student.name.trim()
              ? student.name.trim().charAt(0).toUpperCase()
              : "S"}
          </button>
        </header>

        {profileMessage && (
          <div className="notice" role="status">
            {profileMessage}
          </div>
        )}

        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}

        {page === "Dashboard" && (
          <>
            <section className="welcome-banner">
              <div>
                <p className="eyebrow light">YOUR CAREER STARTS HERE</p>
                <h2>
                  Welcome{student.name ? `, ${student.name}` : ", Student"}!
                </h2>
                <p>
                  Discover opportunities, apply for jobs, and track your
                  placement journey in one place.
                </p>
                <button
                  className="banner-button"
                  onClick={() => setPage("Find Jobs")}
                >
                  Explore Jobs →
                </button>
              </div>
              <div className="banner-symbol">✦</div>
            </section>

            <section className="stats-grid">
              <div className="stat-card">
                <span className="stat-icon">▣</span>
                <p>Available Jobs</p>
                <h2>{jobs.length}</h2>
              </div>
              <div className="stat-card">
                <span className="stat-icon">✓</span>
                <p>My Applications</p>
                <h2>{applications.length}</h2>
              </div>
              <div className="stat-card">
                <span className="stat-icon">♙</span>
                <p>Profile Status</p>
                <h2 className="status-text">
                  {studentId ? "Saved" : "Pending"}
                </h2>
              </div>
            </section>

            <section className="section">
              <div className="section-heading">
                <div>
                  <h2>Latest Opportunities</h2>
                  <p>Explore the latest jobs added to the portal.</p>
                </div>
                <button
                  className="text-button"
                  onClick={() => setPage("Find Jobs")}
                >
                  View all →
                </button>
              </div>

              {loading ? <p>Loading jobs...</p> : <JobList items={jobs.slice(0, 3)} />}
            </section>
          </>
        )}

        {page === "Find Jobs" && (
          <section className="section">
            <div className="section-heading">
              <div>
                <h2>Find your next opportunity</h2>
                <p>Search companies, roles, and locations.</p>
              </div>
            </div>

            <input
              className="search-input"
              type="search"
              placeholder="Search jobs, companies, locations..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            {loading ? <p>Loading jobs...</p> : <JobList items={visibleJobs} />}
          </section>
        )}

        {page === "My Applications" && (
          <section className="section">
            <div className="section-heading">
              <div>
                <h2>My Applications</h2>
                <p>Your application history from the database.</p>
              </div>
            </div>

            {loading ? (
              <p>Loading applications...</p>
            ) : applications.length === 0 ? (
              <div className="empty-panel">
                <div className="empty-icon">▤</div>
                <h3>No applications yet</h3>
                <p>Restore your profile and apply for a job to get started.</p>
                <button
                  className="primary-button"
                  onClick={() => setPage("Find Jobs")}
                >
                  Find Jobs
                </button>
              </div>
            ) : (
              <div className="job-list">
                {applications.map((item) => (
                  <article className="job-card" key={item.id || item.job_id}>
                    <div className="job-heading">
                      <div>
                        <h3>{item.job_title}</h3>
                        <p className="company">{item.company_name}</p>
                      </div>
                      <span className="job-type">{item.status}</span>
                    </div>
                    <p className="location">📍 {item.location}</p>
                    {item.applied_at && (
                      <p>Applied on: {new Date(item.applied_at).toLocaleString()}</p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {page === "My Profile" && (
          <section className="section profile-section">
            <div className="section-heading">
              <div>
                <h2>Student Information</h2>
                <p>
                  Enter your registered email to restore your existing profile,
                  or register a new student.
                </p>
              </div>
            </div>

            <form className="profile-form" onSubmit={saveProfile}>
              <label htmlFor="student-name">Full Name</label>
              <input
                id="student-name"
                value={student.name}
                onChange={(event) =>
                  setStudent({ ...student, name: event.target.value })
                }
                placeholder="Enter your full name"
                required
              />

              <label htmlFor="student-email">Email Address</label>
              <input
                id="student-email"
                type="email"
                value={student.email}
                onChange={(event) =>
                  setStudent({ ...student, email: event.target.value })
                }
                placeholder="Enter your registered email"
                required
              />

              <label htmlFor="student-department">Department</label>
              <select
                id="student-department"
                value={student.department}
                onChange={(event) =>
                  setStudent({ ...student, department: event.target.value })
                }
              >
                <option value="CSE">CSE</option>
                <option value="ECE">ECE</option>
                <option value="EEE">EEE</option>
                <option value="IT">IT</option>
                <option value="Mechanical">Mechanical</option>
                <option value="Civil">Civil</option>
                <option value="Other">Other</option>
              </select>

              <label htmlFor="student-year">Graduation Year</label>
              <input
                id="student-year"
                type="number"
                min="2020"
                max="2100"
                value={student.year}
                onChange={(event) =>
                  setStudent({ ...student, year: event.target.value })
                }
                required
              />

              <button
                type="submit"
                className="primary-button save-button"
                disabled={saving}
              >
                {saving ? "Checking..." : "Save / Load Profile"}
              </button>
            </form>

            {studentId && (
              <p className="saved-note">
                Profile loaded. You can now apply for jobs.
              </p>
            )}
          </section>
        )}

        <footer className="footer">
          Student Placement Management System · Built for your career journey
        </footer>
      </main>
    </div>
  );
}

export default App;
