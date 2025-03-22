'use client'

import { useContext, useContextSelector } from 'use-context-selector'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

export type AppCardProps = {
  app: MarketApp
  onRefresh?: () => void
}

const MarketItem = ({ app, onRefresh }: AppCardProps) => {
  const { t } = useTranslation()
  const { notify } = useContext(ToastContext)

  const { userId, hasPermission } = usePermissionContext();

  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showMarketModal, setShowMarketModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('');

  const onConfirmDelete = useCallback(async () => {
    try {
      await deleteMarketApp(app.id)
      notify({ type: 'success', message: t('market.appDeleted') })
      if (onRefresh)
        onRefresh()
    }
    catch (e: any) {
      notify({
        type: 'error',
        message: `${t('market.appDeleteFailed')}${'message' in e ? `: ${e.message}` : ''}`,
      })
    }
    setShowConfirmDelete(false)
  }, [app.id])

  const onEditMarketApp = useCallback(
    async (params: MarketAppData) => {
      const [err] = await asyncRunSafe(
        updateMarketApp({
          url: `/market-apps/${app.id}`,
          body: params,
        }),
      )
      if (!err) {
        notify({
          type: 'success',
          message: t('market.modifiedSuccessfully'),
        })
        if (onRefresh)
          onRefresh()
        localStorage.setItem(NEED_REFRESH_MARKET_APP_LIST_KEY, '1');
        setShowMarketModal(false);
      }
      else {
        notify({
          type: 'error',
          message: t('market.modifiedUnsuccessfully'),
        })
      }
    },
    [app.id],
  )

  const handleTakeIt = async (marketAppId : string) => {
    const res = await replicateToWorkspace(marketAppId);
    if (res.result == 'success') {
      notify({
        type: 'success',
        message: t('market.toMyWorkspaceSuccess'),
      })

      setShowMarketModal(false)
    } else {
      notify({
        type: 'error',
        message: t('market.toMyWorkspaceFailed') + ' 담당자에게 문의해주세요.',
      })
    }
  }

  const Operations = () => {

    const onClickSettings = (e) => {
      e.stopPropagation();
      setModalTitle(t('market.modal.settings'));
      setShowMarketModal(true);
    };

    const onClickDelete = (e) => {
      e.stopPropagation();
      setShowConfirmDelete(true);
    };

    return (
      <>
        <div className="flex flex-col w-full p-1 space-y-0.5">
          <button className='h-8 w-full px-3 flex items-center gap-2 hover:bg-[#171719]/3.75 rounded-sm cursor-pointer'
            onClick={onClickSettings}>
            <span className={s.actionName}>{t('common.operation.settings')}</span>
          </button>
          <div
            className={cn('h-8 w-full px-3 flex items-center gap-2 hover:bg-[#171719]/3.75 rounded-sm cursor-pointer', 'group')}
            onClick={onClickDelete}
          >
            <span className={cn(s.actionName)}>
              {t('common.operation.delete')}
            </span>
          </div>
        </div>
      </>
    )
  }

  const appType = () => {
    if (app.mode === 'chat')
      return `#${t('market.types.chat')}`
    else if (app.mode === 'completion')
      return `#${t('market.types.completion')}`
    else if (app.mode === 'workflow')
      return `#${t('market.types.workflow')}`
    else if (app.mode === 'agent-chat')
      return `#${t('market.types.agentChat')}`
    else if (app.mode === 'advanced-chat')
      return `#${t('market.types.advancedChat')}`
    else if (app.mode === 'analytics-chat')
      return `#${t('market.types.analyticsChat')}`
  }

  return (
    <>
      <div 
        className={cn('flex flex-col cursor-pointer justify-between px-5 py-4 bg-white rounded-[15px] shadow-card hover:shadow-cardhover hover:bg-[#FCFDFF]')}
        onClick={() => {
          if (showMarketModal)
            return;

          setModalTitle(t('market.modal.read'));
          setShowMarketModal(true);
        }}
      >
        {/* 제목, 태그부분 */}
        <div>
          <div className='flex justify-between items-center'>
            <div className={cn('h-8 leading-8 grow text-[20px] font-bold text-[#333333] !line-clamp-1')}>
              {app.name}
            </div>
            {(hasPermission('MARKET_ADMIN', 'update') || app.creator == userId) && <CustomPopover
              htmlContent={<Operations />}
              position="br"
              trigger="click"
              btnOpenColor='!text-aionUprimary-80'
              btnElement={<ItemSetting className='w-5 h-5 text-aionUneutral-50 group-hover:text-aionUprimary-80'/>}
              btnClassName={'flex justify-center items-center border-none !p-0 w-9 h-9 inline-block align-middle !rounded text-aionUneutral-50 !hover:text-aionUprimary-80'}
              className={'!w-[128px] h-fit'}
              popupClassName='border border-[#70737C]/[.16] !rounded'
              manualClose
            />}
          </div>
          <div className={cn('flex flex-wrap max-h-20 my-1 overflow-y-auto')}>
            {app.hashcode.map((item, index) => (
              index == 0 ? 
              <div key={index} className='px-2 py-0.5 mr-1 mb-1 shrink-0 bg-[#F6637E]/20 rounded text-[0.6875rem] font-bold text-[#F6637E]'>
                {appType()}
              </div>
              :
              <div key={index} className='px-2 py-0.5 mr-1 mb-1 shrink-0 bg-[#EEF0FF] rounded text-[0.6875rem] font-bold text-[#626366]'>
                {item}
              </div>
            ))}
          </div>
        </div>
        {/* 설명, 날짜부분 */}
        <div>
          <div className='h-16 text-sm overflow-y-auto'>
            <span>{app.description}</span>
          </div>
          <div className='flex items-end'>
            <span className='font-normal text-[0.75rem] text-aionUneutral-40 mr-[15px]'>
              {t('market.operation.update')} {dayjs(app.updated_at).tz(getLocalTimezone()).format('YYYY-MM-DD HH:mm:ss')}
            </span>
          </div>
        </div>

        {showConfirmDelete && (
          <AionuConfirm 
            title={t('market.deleteAppConfirmTitle')}
            content={t('market.deleteAppConfirmContent')}
            isShow={showConfirmDelete}
            onClose={() => setShowConfirmDelete(false)}
            onConfirm={onConfirmDelete}
            confirmText={t('common.operation.delete')}
            onCancel={() => setShowConfirmDelete(false)}
            modalClassName='!w-[500px]'
            isWarning
          />
        )}
        {showMarketModal && (
          <MarketModal
            appInfo={app}
            modalTitle={modalTitle}
            isShow={showMarketModal}
            onClose={() => setShowMarketModal(false)}
            onUpdate={onEditMarketApp}
            onTake={handleTakeIt}
          />
        )}
      </div>
    </>
  )
}

export default MarketItem
