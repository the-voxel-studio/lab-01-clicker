import { describe, it, expect } from 'vitest'

import { mount } from '@vue/test-utils'
import App from '../App.vue'

describe('App', () => {
  it('renders title properly and mobile first header', () => {
    const wrapper = mount(App)
    expect(wrapper.text()).toContain('The Grand Audit')
    expect(wrapper.text()).toContain('Mobile First')
  })

  it('renders navigation tabs and switches views', async () => {
    const wrapper = mount(App)
    expect(wrapper.text()).toContain('Game Mockup')
    expect(wrapper.text()).toContain('Icons (81)')
    expect(wrapper.text()).toContain('Theme & Styles')

    // Default view contains the Game Mockup seal button
    expect(wrapper.text()).toContain('SEAL DECREE')

    // Click Icons tab
    const buttons = wrapper.findAll('nav button')
    expect(buttons.length).toBe(3)
    await buttons[1]!.trigger('click')
    expect(wrapper.text()).toContain('Icon Gallery (81 / 81)')

    // Click Theme tab
    await buttons[2]!.trigger('click')
    expect(wrapper.text()).toContain('Dark Feudal Design System')
  })

  it('increments AP on Seal Decree click in Game Mockup', async () => {
    const wrapper = mount(App)
    const sealButton = wrapper.find('button[class*="bg-wax-red"]')
    expect(sealButton.exists()).toBe(true)

    const initialText = wrapper.text()
    expect(initialText).toContain('845 AP')

    await sealButton.trigger('click')
    expect(wrapper.text()).toContain('847.4 AP')
  })
})
