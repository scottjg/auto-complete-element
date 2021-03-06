/* @flow strict */

import type AutocompleteElement from './auto-complete-element'
import debounce from './debounce'
import {fragment} from './send'
import {install as installCombobox, uninstall as uninstallCombobox} from '@github/combobox-nav'

export default class Autocomplete {
  container: AutocompleteElement
  input: HTMLInputElement
  results: HTMLElement
  allowBlank: boolean
  stayExpanded: boolean

  onInputChange: () => void
  onResultsMouseDown: () => void
  onInputBlur: () => void
  onInputFocus: () => void
  onKeydown: KeyboardEvent => void
  onCommit: Event => void

  interactingWithList: boolean

  constructor(container: AutocompleteElement, input: HTMLInputElement, results: HTMLElement) {
    this.container = container
    this.input = input
    this.results = results

    this.results.hidden = true
    this.input.setAttribute('autocomplete', 'off')
    this.input.setAttribute('spellcheck', 'false')

    this.interactingWithList = false
    this.allowBlank = this.input.hasAttribute('allow-blank')
    this.stayExpanded = this.input.hasAttribute('stay-expanded')

    this.onInputChange = debounce(this.onInputChange.bind(this), 300)
    this.onResultsMouseDown = this.onResultsMouseDown.bind(this)
    this.onInputBlur = this.onInputBlur.bind(this)
    this.onInputFocus = this.onInputFocus.bind(this)
    this.onKeydown = this.onKeydown.bind(this)
    this.onCommit = this.onCommit.bind(this)

    this.input.addEventListener('keydown', this.onKeydown)
    this.input.addEventListener('focus', this.onInputFocus)
    this.input.addEventListener('blur', this.onInputBlur)
    this.input.addEventListener('input', this.onInputChange)
    this.results.addEventListener('mousedown', this.onResultsMouseDown)
    this.results.addEventListener('combobox-commit', this.onCommit)
  }

  destroy() {
    this.input.removeEventListener('keydown', this.onKeydown)
    this.input.removeEventListener('focus', this.onInputFocus)
    this.input.removeEventListener('blur', this.onInputBlur)
    this.input.removeEventListener('input', this.onInputChange)
    this.results.removeEventListener('mousedown', this.onResultsMouseDown)
    this.results.removeEventListener('combobox-commit', this.onCommit)
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && this.container.open) {
      this.container.open = false
      event.stopPropagation()
      event.preventDefault()
    }
  }

  onInputFocus() {
    this.fetchResults()
  }

  onInputBlur() {
    if (this.interactingWithList) {
      this.interactingWithList = false
      return
    }
    if (!this.stayExpanded) this.container.open = false
  }

  onCommit({target}: Event) {
    const selected = target
    if (!(selected instanceof HTMLElement)) return
    this.container.open = false
    if (selected instanceof HTMLAnchorElement) return
    const value = selected.getAttribute('data-autocomplete-value') || selected.textContent
    this.container.value = value
  }

  onResultsMouseDown() {
    this.interactingWithList = true
  }

  onInputChange() {
    this.container.removeAttribute('value')
    this.fetchResults()
  }

  identifyOptions() {
    let id = 0
    for (const el of this.results.querySelectorAll('[role="option"]:not([id])')) {
      el.id = `${this.results.id}-option-${id++}`
    }
  }

  fetchResults() {
    const query = this.input.value.trim()
    if (!query && !this.allowBlank) {
      this.container.open = false
      return
    }

    const src = this.container.src
    if (!src) return

    const url = new URL(src, window.location.href)
    const params = new URLSearchParams(url.search.slice(1))
    params.append('q', query)
    url.search = params.toString()

    this.container.dispatchEvent(new CustomEvent('loadstart'))
    fragment(this.input, url.toString())
      .then(html => {
        this.results.innerHTML = html
        this.identifyOptions()
        const hasResults = !!this.results.querySelector('[role="option"]')
        this.container.open = hasResults
        this.container.dispatchEvent(new CustomEvent('load'))
        this.container.dispatchEvent(new CustomEvent('loadend'))
      })
      .catch(() => {
        this.container.dispatchEvent(new CustomEvent('error'))
        this.container.dispatchEvent(new CustomEvent('loadend'))
      })
  }

  open() {
    if (!this.results.hidden) return
    installCombobox(this.input, this.results)
    this.results.hidden = false
    this.container.setAttribute('aria-expanded', 'true')
  }

  close() {
    if (this.results.hidden) return
    uninstallCombobox(this.input, this.results)
    this.results.hidden = true
    this.input.removeAttribute('aria-activedescendant')
    this.container.setAttribute('aria-expanded', 'false')
  }
}
