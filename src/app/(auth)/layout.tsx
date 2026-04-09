export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-surface-container-low min-h-screen selection:bg-primary-container selection:text-on-primary-container">
      {children}
    </div>
  )
}
