import os
from flask import Flask
from flask import Flask, request, jsonify, make_response
from flask_sqlalchemy import SQLAlchemy


def create_app():
    app = Flask(__name__)
    
    from .views import views

    app.register_blueprint(views, url_prefix='/')

    return app
