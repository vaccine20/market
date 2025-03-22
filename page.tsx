
import { PermissionContextProvider } from '@/context/permission-context'
import Market from './Market'

const MarketAppList = async () => {

  return (
      <div className='flex flex-col shrink-0 grow '> 
        <Market />
      </div >
  )
}

export default MarketAppList
