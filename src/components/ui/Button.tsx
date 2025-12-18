import React from 'react'
import clsx from 'clsx'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'gold' | 'dark' | 'outline' | 'danger'
  full?: boolean
}

export default function Button({ className, variant = 'dark', full, ...props }: ButtonProps) {
  const base = 'btn'
  const style =
    variant === 'gold' ? 'btn-gold' :
    variant === 'dark' ? 'btn-dark' :
    variant === 'danger' ? 'btn-danger' :
    'btn-outline'

  return (
    <button {...props} className={clsx(base, style, full && 'w-full', className)} />
  )
}
