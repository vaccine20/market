from datetime import datetime
from sqlalchemy import func, and_, or_

from flask_sqlalchemy.pagination import Pagination

from flask_login import current_user
from services.errors.app import WorkflowContainAppCallerError
from events.app_event import app_was_created
from extensions.ext_database import db
from models.model import App, AppMode, AppModelConfig, Site, InstalledApp, MarketApp
from models.workflow import Workflow
from models.organization import OrganizationAccountJoin



class MarketAppService:
    def get_paginate_apps(self, args: dict) -> Pagination:
        """
        Get market app list with pagination
      
        """
        filters = [
            MarketApp.efct_fns_dt > func.now(),
            MarketApp.efct_st_dt < func.now()
        ]
        
        if args['mode'] is not None:
            if args['mode'] == 'chat':
                filters.append(MarketApp.mode == AppMode.CHAT.value)
            elif args['mode'] == 'completion':
                filters.append(MarketApp.mode == AppMode.COMPLETION.value)
            elif args['mode'] == 'agent-chat':
                filters.append(MarketApp.mode == AppMode.AGENT_CHAT.value)
            elif args['mode'] == 'workflow':
                filters.append(MarketApp.mode == AppMode.WORKFLOW.value)
            elif args['mode'] == 'advanced-chat':
                filters.append(MarketApp.mode == AppMode.ADVANCED_CHAT.value)
            elif args['mode'] == 'channel':
                filters.append(MarketApp.mode == AppMode.CHANNEL.value)
            elif args['mode'] == 'analytics-chat':
                filters.append(MarketApp.mode == AppMode.ANALYTICS_CHAT.value)
            elif args['mode'] == 'multi-agent-chat':
                filters.append(MarketApp.mode == AppMode.MULTI_AGENT_CHAT.value)
        
        if args['search'] is not None:
            search = args['search'][:30]
            filters.append(
                or_(
                    MarketApp.name.ilike(f'%{search}%'),
                    MarketApp.hashcode.contains([search])
                )
            )
        
        return db.paginate(
            db.select(MarketApp).where(*filters).order_by(
                MarketApp.important.desc(),
                MarketApp.efct_st_dt.desc()
            ),
            page=args['page'],
            per_page=args['limit'],
            error_out=False
        )


    def create_app(self, args: dict) -> bool:
        """
        Create market app
        
        """
        source_app: App = db.session.query(App).filter(App.id == args['app_id']).first()
        creator_org_id = db.session.query(OrganizationAccountJoin.organization_id).filter(OrganizationAccountJoin.account_id == current_user.id).first()[0]
        
        new_market_app = MarketApp(
            name = args['name'],
            description = args['description'],
            hashcode = args['hashcode'],
            app_id = source_app.id,
            mode = source_app.mode,
            creator_organization_id = creator_org_id,
            creator = current_user.id,
            important = args['important'],
            created_by = current_user.id
        )
        db.session.add(new_market_app)
        db.session.flush()
        
        # 워크플로우형 챗봇일 경우 workflows 복제 else app_model_configs 복제
        if source_app.mode == AppMode.ADVANCED_CHAT.value:
            workflow_id = self._create_workflow(source_app, new_market_app.id)
            new_market_app.workflow_id = workflow_id
        else:
            app_model_config_id = self._create_app_model_config(source_app, new_market_app.id)
            new_market_app.app_model_config_id = app_model_config_id

        self._copy_site_and_installed_app(source_app, new_market_app.id)
        db.session.commit()
        
        return True
        

    def patch_app(self, args: dict, app_id: str) -> bool:
        """
        patch market app
        
        """
        market_app: MarketApp = db.session.query(MarketApp).filter(MarketApp.id == app_id).first()
        
        if args['name'] is not None:
            market_app.name = args['name']
        
        if args['description'] is not None:
            market_app.description = args['description']
        
        if args['hashcode'] is not None:
            market_app.hashcode = args['hashcode']
     
        if args['important'] is not None:
            market_app.important = args['important']
        
        market_app.updated_at = datetime.utcnow()
        market_app.updated_by = current_user.id
        
        db.session.commit()
        
        return True

    
    def delete_app(self, app_id: str) -> bool:
        """ Delete market app """
        market_app: MarketApp = db.session.query(MarketApp).filter(MarketApp.id == app_id).first()
        
        market_app.efct_fns_dt = datetime.utcnow()
        market_app.updated_at = datetime.utcnow()
        market_app.updated_by = current_user.id
        
        db.session.commit()
        
        return True
    
    
    def transferAppToStudio(self, app_id: str) -> None:
        """ 마켓에서 스튜디오로 앱 가져가기 (마켓으로 가져왔을 시점의 원본앱의 상태를 복제) """
        source_market_app: MarketApp = db.session.query(MarketApp).filter(MarketApp.id == app_id).first()
        
        # create new app
        new_app = App(
            tenant_id = current_user.current_tenant_id,
            name = source_market_app.name,
            mode = source_market_app.mode,
            enable_site = True,
            enable_api = True,
            description = source_market_app.description
        )

        db.session.add(new_app)
        db.session.flush()
        
        # 워크플로우형 챗봇일 경우 workflows 복제 else app_model_configs 복제
        if source_market_app.mode == AppMode.ADVANCED_CHAT.value:
            self._create_workflow(source_market_app, new_app.id, current_user.current_tenant_id)
            
        else:
            app_model_config_id = self._create_app_model_config(source_market_app, new_app.id)
            new_app.app_model_config_id = app_model_config_id

        app_was_created.send(new_app, account=current_user)
        db.session.commit()
        
        
        

    def _create_workflow(self, source_app, new_app_id: str, current_user_tenant_id: str = None) -> str:
        """
        워크플로우 생성
        
        'app-caller'라는 노드가 워크플로우 그래프에 존재하는 경우 error 노출
        
        """    
        source_workflow = db.session.query(Workflow).filter(
            and_(
                    Workflow.app_id == source_app.id,
                    Workflow.version == 'draft'
            )
        ).first()

        if 'app-caller' in source_workflow.graph:
            raise WorkflowContainAppCallerError("Invalid workflow: 'app-caller' node is present in the workflow graph")
        
        # tenant_id를 current_user_tenant_id로 설정하거나 없으면 source_app.tenant_id로 설정
        tenant_id = current_user_tenant_id if current_user_tenant_id else source_app.tenant_id

        new_workflow = Workflow(
            tenant_id= tenant_id,
            app_id=new_app_id,
            type=source_workflow.type,
            version='draft',
            graph=source_workflow.graph,
            features=source_workflow.features,
            created_by=current_user.id,
            app_caller_nodes=source_workflow.app_caller_nodes
        )
        db.session.add(new_workflow)
        db.session.flush()
        
        return new_workflow.id
        
    
    def _create_app_model_config(self, source_app: App, new_app_id: int) -> str:
        source_config = db.session.query(AppModelConfig).filter(
            AppModelConfig.app_id == source_app.id
        ).order_by(AppModelConfig.created_at.desc()).first()

        new_config = AppModelConfig(
            app_id=new_app_id,
            provider=source_config.provider,
            model_id=source_config.model_id,
            configs=source_config.configs,
            opening_statement=source_config.opening_statement,
            suggested_questions=source_config.suggested_questions,
            suggested_questions_after_answer=source_config.suggested_questions_after_answer,
            more_like_this=source_config.more_like_this,
            model=source_config.model,
            user_input_form=source_config.user_input_form,
            pre_prompt=source_config.pre_prompt,
            agent_mode=source_config.agent_mode,
            speech_to_text=source_config.speech_to_text,
            sensitive_word_avoidance=source_config.sensitive_word_avoidance,
            retriever_resource=source_config.retriever_resource,
            dataset_query_variable=source_config.dataset_query_variable,
            prompt_type=source_config.prompt_type,
            chat_prompt_config=source_config.chat_prompt_config,
            completion_prompt_config=source_config.completion_prompt_config,
            dataset_configs=source_config.dataset_configs,
            external_data_tools=source_config.external_data_tools,
            file_upload=source_config.file_upload,
            text_to_speech=source_config.text_to_speech
        )
        db.session.add(new_config)
        db.session.flush()
        
        return new_config.id

    def _copy_site_and_installed_app(self, source_app: App, new_app_id: int) -> None:
        source_site = db.session.query(Site).filter(Site.app_id == source_app.id).first()
        if source_site:
            new_site = Site(
                app_id=new_app_id,
                title=source_site.title,
                icon=source_site.icon,
                icon_background=source_site.icon_background,
                description=source_site.description,
                default_language=source_site.default_language,
                copyright=source_site.copyright,
                privacy_policy=source_site.privacy_policy,
                custom_disclaimer=source_site.custom_disclaimer,
                customize_domain=source_site.customize_domain,
                customize_token_strategy=source_site.customize_token_strategy,
                prompt_public=source_site.prompt_public,
                status=source_site.status,
                code=Site.generate_code(16)
            )
            db.session.add(new_site)
            db.session.flush()

        source_installed_app = db.session.query(InstalledApp).filter(InstalledApp.app_id == source_app.id).first()
        if source_installed_app:
            new_installed_app = InstalledApp(
                tenant_id=source_app.tenant_id,
                app_id=new_app_id,
                app_owner_tenant_id=source_installed_app.app_owner_tenant_id,
                position=source_installed_app.position
            )
            db.session.add(new_installed_app)
            db.session.flush()
    

   