from flask import Blueprint, flash, redirect, render_template, request, url_for

import requests
views = Blueprint('views', __name__)

@views.route('/', methods=['GET', 'POST'])
def index():
    return render_template("index.html")    

