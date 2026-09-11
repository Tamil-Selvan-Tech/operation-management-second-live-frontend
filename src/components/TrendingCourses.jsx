import { BookOpen, GraduationCap, Trophy } from 'lucide-react'

function CourseSkeleton() {
  return <div className="sa-trending-course sa-trending-skeleton-card"><span /><div><i /><i /><b /></div><strong /></div>
}

export function TrendingCourses({ courses = [], month = '', isLoading = false }) {
  return <section className="sa-trending-courses" aria-labelledby="trending-courses-title">
    <div className="sa-trending-heading"><div><h2 id="trending-courses-title">Trending Courses</h2><p>Top courses by student admissions this month</p></div><span className="sa-trending-period">{month || 'This Month'}</span></div>
    {isLoading ? <div className="sa-trending-list"><CourseSkeleton /><CourseSkeleton /><CourseSkeleton /></div> : courses.length ? <div className="sa-trending-list">{courses.map((course) => <article className={`sa-trending-course ${course.rank === 1 ? 'is-top' : ''}`} key={course.courseId || course.courseName}>
      <div className="sa-trending-rank">{course.rank === 1 ? <Trophy size={15} /> : `#${course.rank}`}</div>
      <span className="sa-trending-course-icon"><GraduationCap size={18} /></span>
      <div className="sa-trending-course-info"><strong title={course.courseName}>{course.courseName}</strong>{course.rank === 1 ? <em>Top Trending</em> : null}<span>{course.admissionCount} admissions this month</span><div className="sa-trending-progress"><i style={{ width: `${Math.min(100, Math.max(0, Number(course.progress) || 0))}%` }} /></div></div>
      <div className="sa-trending-course-total"><strong>{course.admissionCount}</strong><span>Admissions</span></div>
    </article>)}</div> : <div className="sa-trending-empty"><BookOpen size={24} /><strong>No admissions this month</strong><span>Trending courses will appear here once new admissions are recorded.</span></div>}
  </section>
}
