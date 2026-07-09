from sqlalchemy import Boolean, Column, Integer, String, Float, ForeignKey, JSON
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password = Column(String)
    role = Column(String, default="student") # admin, student
    grade = Column(Integer, default=1) # 1 or 3
    points = Column(Integer, default=0)
    
class Question(Base):
    __tablename__ = "questions"
    id = Column(Integer, primary_key=True, index=True)
    subject = Column(String) # math, vietnamese, english
    grade = Column(Integer)
    difficulty = Column(Integer, default=1)
    type = Column(String) # multiple_choice, reading, fill_blank
    content = Column(String) 
    options = Column(JSON, nullable=True) 
    answer = Column(String)

class Result(Base):
    __tablename__ = "results"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    question_id = Column(Integer, ForeignKey("questions.id"))
    is_correct = Column(Boolean)
    points_earned = Column(Integer)
    time_taken = Column(Float) # in seconds
    
    user = relationship("User")
    question = relationship("Question")

class RewardConfig(Base):
    __tablename__ = "reward_configs"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    cost = Column(Integer) # points required
    probability = Column(Float, nullable=True) # for gacha wheel

class SpinHistory(Base):
    __tablename__ = "spin_history"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    reward_id = Column(Integer, ForeignKey("reward_configs.id"))
    
    user = relationship("User")
    reward = relationship("RewardConfig")
