from extensions.ext_database import db
from flask_login import current_user
from flask_restful import Resource, inputs, marshal_with, reqparse
from werkzeug.exceptions import Forbidden

from services.errors.app import WorkflowContainAppCallerError
from controllers.console import api
from controllers.console.setup import setup_required
from controllers.console.wraps import account_initialization_required, cloud_edition_billing_resource_check
from fields.market_app_fields import app_pagination_fields
from libs.login import login_required
from services.market_app_service import MarketAppService
from models.model import MarketApp

APP_MODES = ['all', 'chat', 'completion', 'agent-chat', 'multi-agent-chat', 'workflow', 'advanced-chat', 'channel', 'analytics-chat'] # 20250120_KHA_멀티에이전트 추가
ALLOW_CREATE_APP_MODES = ['chat', 'completion', 'agent-chat', 'multi-agent-chat', 'workflow', 'advanced-chat', 'analytics-chat'] # 20250120_KHA_멀티에이전트 추가

class MarketListApi(Resource):

    @setup_required
    @login_required
    @account_initialization_required
    @marshal_with(app_pagination_fields)
    def get(self):
        """Get market app list"""
        parser = reqparse.RequestParser()
        parser.add_argument('page', type=inputs.int_range(1, 99999), required=False, default=1, location='args')
        parser.add_argument('limit', type=inputs.int_range(1, 100), required=False, default=20, location='args')
        parser.add_argument('mode', type=str, choices=APP_MODES, default='all', location='args', required=False)
        parser.add_argument('search', type=str, location='args', required=False)
        args = parser.parse_args()

        # get app list
        market_app_service = MarketAppService()
        app_pagination = market_app_service.get_paginate_apps(args)  # app_pagination.items에 list형태로 앱들을 가져옴
        
        return app_pagination
      
    @setup_required
    @login_required
    @account_initialization_required
    @cloud_edition_billing_resource_check('apps')
    def post(self):
        """Create market app"""
        parser = reqparse.RequestParser()
        parser.add_argument('app_id', type=str, required=True, location='json')
        parser.add_argument('name', type=str, required=True, location='json')
        parser.add_argument('description', type=str, location='json')
        parser.add_argument('mode', type=str, choices=ALLOW_CREATE_APP_MODES, location='json')  # ['chat', 'agent-chat', 'advanced-chat', 'workflow', 'completion']
        parser.add_argument('hashcode', type=list, location='json')
        parser.add_argument('important', type=int, location='json')
        args = parser.parse_args()
        
        if not any(role in current_user.roles for role in ['ADMIN', 'MANAGER', 'SUB_MANAGER']):
            raise Forbidden()

        market_app_service = MarketAppService()
        try:
            market_app_service.create_app(args)
        except WorkflowContainAppCallerError as e:
            return {'result': 'app_caller_error'}, 200

        return {'result': 'success'}, 201

class MarketAppApi(Resource):
    @setup_required
    @login_required
    @account_initialization_required
    def patch(self, app_id):
        """Patch app detail"""
        parser = reqparse.RequestParser()
        parser.add_argument('name', type=str, location='json')
        parser.add_argument('description', type=str, location='json')
        parser.add_argument('hashcode', type=list, location='json')
        parser.add_argument('important', type=int, location='json')
        args = parser.parse_args()
        
        marketapp = db.session.query(MarketApp).filter(MarketApp.id == app_id).first()
        
        if not any(role in current_user.roles for role in ['ADMIN']) and marketapp.creator != current_user.id:
            raise Forbidden()
        
        market_app_service = MarketAppService()
        result = market_app_service.patch_app(args, app_id)
        
        if not result:
          return {'result': 'fail'}, 400
        
        return {'result': 'success'}, 200
    
    @setup_required
    @login_required
    @account_initialization_required
    def delete(self, app_id):
        """Delete app detail"""
        
        marketapp = db.session.query(MarketApp).filter(MarketApp.id == app_id).first()
        
        if not any(role in current_user.roles for role in ['ADMIN']) and marketapp.creator != current_user.id:
            raise Forbidden()
        
        market_app_service = MarketAppService()
        result = market_app_service.delete_app(app_id)
        
        if not result:
          return {'result': 'fail'}, 400
        
        return {'result': 'success'}, 200
    
    @setup_required
    @login_required
    @account_initialization_required
    def post(self, app_id):
        """transfer market app to studio app"""
        
        market_app_service = MarketAppService()
        market_app_service.transferAppToStudio(app_id)
        
        return {'result': 'success'}, 200
      
api.add_resource(MarketListApi, '/market-apps')
api.add_resource(MarketAppApi, '/market-apps/<uuid:app_id>')