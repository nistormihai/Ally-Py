'''
Created on Aug 25, 2011

@package: ally core sql alchemy
@copyright: 2012 Sourcefabric o.p.s.
@license: http://www.gnu.org/licenses/gpl-3.0.txt
@author: Gabriel Nistor

API specifications for article type.
'''

from ally.api.config import model, service, query
from ally.api.criteria import AsLikeOrdered
from ally.support.api.entity_ided import Entity, IEntityService

# --------------------------------------------------------------------

@model
class ArticleType(Entity):
    '''
    Provides the article type model.
    '''
    Id = int
    Name = str

# --------------------------------------------------------------------

@query(ArticleType)
class QArticleType:
    '''
    Provides the query article type model.
    '''
    name = AsLikeOrdered

# --------------------------------------------------------------------

@service((Entity, ArticleType))
class IArticleTypeService(IEntityService):
    '''
    Provides services for article types.
    '''
