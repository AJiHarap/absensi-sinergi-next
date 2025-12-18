import React from 'react'
import clsx from 'clsx'

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  header?: React.ReactNode
  footer?: React.ReactNode
}

export default function Card({ className, header, footer, children, ...props }: CardProps) {
  return (
    <div {...props} className={clsx('card', className)}>
      {header !== undefined && <div className="card-header">{header}</div>}
      <div className="card-body">{children}</div>
      {footer !== undefined && <div className="card-header">{footer}</div>}
    </div>
  )
}
