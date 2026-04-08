export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-container-low p-6 selection:bg-primary-container selection:text-on-primary-container">
      {children}
    </div>
  )
}
