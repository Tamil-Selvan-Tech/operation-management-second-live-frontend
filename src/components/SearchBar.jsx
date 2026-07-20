import { Search } from 'lucide-react'

export function SearchBar({
  className = '',
  inputClassName = '',
  buttonClassName = '',
  value,
  onChange,
  onSubmit,
  placeholder = 'Search',
  ariaLabel = 'Search',
  disabled = false,
}) {
  const handleSubmit = (event) => {
    event.preventDefault()
    onSubmit?.(event)
  }

  return (
    <form className={`search-bar ${className}`.trim()} onSubmit={handleSubmit}>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        disabled={disabled}
        className={inputClassName}
      />
      <button type="submit" className={`search-bar-button ${buttonClassName}`.trim()} aria-label={ariaLabel} disabled={disabled}>
        <Search size={20} />
      </button>
    </form>
  )
}
