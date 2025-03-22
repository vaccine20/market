'use client'

import { useEffect, useRef, useState } from 'react'
import useSWRInfinite from 'swr/infinite'
import { useTranslation } from 'react-i18next'

const getPageData = (
  pageIndex: number,
  previousPageData: MarketAppListResponse,
  activeTab: string,
  keywords: string,
) => {
  if (!pageIndex || previousPageData.has_more) {
    const params: any = { url: 'market-apps', params: { page: pageIndex + 1, limit: 20, search: keywords } }

    if (activeTab !== 'all')
      params.params.mode = activeTab
    else
      delete params.params.mode

    return params
  }
  return null
};

const Market = () => {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useTabSearchParams({
    defaultTab: 'all',
  })
  const [keywords, setKeywords] = useState('')
  const [searchKeywords, setSearchKeywords] = useState('')

  const [count, setCount] = useState(0)
  const { data, isLoading, setSize, mutate } = useSWRInfinite(
    (pageIndex: number, previousPageData: MarketAppListResponse) => getPageData(pageIndex, previousPageData, activeTab, searchKeywords.replace('#', '').trim()),
    fetchMarketAppList,
    { revalidateFirstPage: true },
  );

  const anchorRef = useRef<HTMLDivElement>(null);
  const options = [
    { value: 'all', text: t('market.types.all')},
    { value: 'chat', text: t('market.types.chat')},
    { value: 'agent-chat', text: t('market.types.agentChat')},
    { value: 'advanced-chat', text: t('market.types.advancedChat')},
    { value: 'analytics-chat', text: t('market.types.analyticsChat')},
  ]

  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    let observer: IntersectionObserver | undefined;
    if (anchorRef.current) {

      observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !isLoading) {
          setSize((size: number) => size + 1)
        }
      }, { rootMargin: '300px' })

      observer.observe(anchorRef.current)
    }

    if (!hasMore && observer) {
      observer.disconnect();
    }

    return () => observer?.disconnect();
  }, [hasMore, isLoading, setSize, anchorRef, mutate])

  useEffect(() => {
    const dataCount
      = data
        ? data.reduce((acc, { data: datasets }) => {
          return acc + datasets.length
        }, 0)
        : 0

    setCount(dataCount)
    setHasMore(data ? data[data.length - 1].has_more : true);
  }, [data])

  const handleKeywordsChange = (value: string) => {
    setKeywords(value)
    handleSearch()
  }

  return (
    <>
      <div className='flex flex-col mt-10 px-[34px] pb-2 flex-wrap'>
        <div className='flex justify-between items-center'>
          <div className='font-bold text-[28px]'>{t('market.title')}</div>
        </div>
        <div className='flex justify-between mt-5 flex-wrap gap-y-2'>
          <div className='flex flex-col items-end'>
            <div className='flex-1 flex flex-row items-center gap-1.5 bg-[#f4f7fd] border rounded-[50px] w-[358px] h-10'>
              <div className='w-5 h-5 relative overflow-hidden shrink-0 flex items-center content-center justify-center ml-4'>
                <SearchIcon className='w-[14px] h-[14px]'/>
              </div>
              <div className='flex-1 overflow-hidden flex flex-row items-start justify-start h-10 bg-transparent'>
                <input
                  type="text"
                  name="query"
                  className="self-stretch flex-1 relative leading-[150%] flex items-center bg-transparent appearance-none outline-none text-aionuSizeBase"
                  placeholder={t('market.operation.search')}
                  value={keywords}
                  onChange={(e) => {
                    handleKeywordsChange(e.target.value)
                  }}
                  autoComplete="off"
                />
              </div>
            </div>
            <div className='flex flex-row mt-5 ml-3 text-xs'>
              <div className='bottom-0 font-normal text-[#626366]'>{t('app.count')}</div>
              <div className='ml-1 font-bold text-[#393939]'>{count}</div>
            </div>
          </div>
        </div>
      </div>
      <div className='grid content-start lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-1 gap-6 px-[34px] pt-2 grow shrink-0 h-0 overflow-y-auto pb-3'>
        {data && data[0].data.length !== 0 ? 
          <>
            {data?.map(({ data: apps }: any) => apps.map((app: any) => (
              <MarketItem key={app.id} app={app} onRefresh={mutate} />
            )))}
            {/* <CheckModal /> */}
            <div ref={anchorRef} className='h-0' />
          </>
          :
          <div className='italic text-gray-400'>
            {t('market.operation.noData')}
          </div>
        }
      </div>
    </>
  )
}

export default Market
