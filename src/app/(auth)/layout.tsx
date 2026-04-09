export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#fefae8] min-h-screen selection:bg-primary-container selection:text-on-primary-container">
      {children}
    </div>
  )
}
