// import { useState } from 'react'
import DataShowSection from "./components/DataShowSection"
import SandTableSection from "./components/SandTableSection"
import SettingSection from "./components/SettingSection"
import { ScrollArea } from "./components/ui/scroll-area"

import '../src/App.css'
function App() {
  return (
    <div className="app-root flex flexrow h-screen justify-center items-center">
      <ScrollArea className=" data-showing-section w-[500px] max-lg:flex-1 h-screen">
        <DataShowSection></DataShowSection>
      </ScrollArea>
      <div className="sand-table-section min-h-full flex-auto">
        <SandTableSection></SandTableSection>
      </div>

      <ScrollArea className="setting-section w-[350px] max-lg:flex-1 h-screen">
        <SettingSection></SettingSection>
      </ScrollArea>
    </div>
  )
}

export default App
